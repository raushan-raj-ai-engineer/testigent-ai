import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { resolveApplicationScope } from '../core/config/application.scope';
import { WorkspaceContext } from '../core/config/workspace.context';
import type { HealingDecision, LocatorDescriptor, LocatorPlan } from './healing.types';

interface CacheProvenance {
  application: string;
  environment: string;
  planRevision: string;
}

export interface CacheRecord {
  descriptor: LocatorDescriptor;
  confidence: number;
  updatedAt: string;
  expiresAt: string;
  validation: 'semantic';
  verificationDescription?: string;
  provenance: CacheProvenance;
}

interface CacheDocument {
  schemaVersion: 2;
  records: Record<string, CacheRecord>;
}

/**
 * Environment- and plan-revision-scoped cache for semantically validated AI locator recovery.
 * Writes are lock-protected and atomically published so concurrent workers cannot lose each other's entries.
 */
export class HealingCache {
  private readonly application: string;
  private readonly environment: string;
  private readonly filePath: string;
  private readonly lockPath: string;

  constructor(filePath?: string) {
    this.application = resolveApplicationScope();
    this.environment = resolveEnvironmentScope(this.application);
    this.filePath = filePath ?? path.resolve('.healing', this.application, this.environment, 'locator-cache.json');
    this.lockPath = `${this.filePath}.lock`;
  }

  get(plan: LocatorPlan): CacheRecord | undefined {
    const record = this.load().records[plan.id];
    if (!record || record.validation !== 'semantic') return undefined;
    const expectedRevision = planRevision(plan);
    const status = this.recordStatus(record, expectedRevision);
    if (status === 'valid') return record;

    this.diagnostic(
      status === 'expired' ? 'HEALING_CACHE_EXPIRED' : 'HEALING_CACHE_INCOMPATIBLE',
      `Rejected ${status === 'expired' ? 'expired' : 'stale/incompatible'} cache entry '${plan.id}'.`,
    );
    // Re-check under the write lock before pruning. Another worker may have refreshed this plan
    // after our lock-free read; an old reader must never delete a newly published valid entry.
    this.pruneIfStillInvalid(plan.id, expectedRevision);
    return undefined;
  }

  set(plan: LocatorPlan, decision: HealingDecision, verificationDescription: string): void {
    const ttlMs = positiveInteger(process.env.HEALING_CACHE_TTL_MS, 7 * 24 * 60 * 60 * 1000);
    this.mutate(document => {
      document.records[plan.id] = {
        descriptor: decision.descriptor,
        confidence: decision.confidence,
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + ttlMs).toISOString(),
        validation: 'semantic',
        verificationDescription,
        provenance: {
          application: this.application,
          environment: this.environment,
          planRevision: planRevision(plan),
        },
      };
    });
  }

  delete(planId: string): void {
    this.mutate(document => { delete document.records[planId]; });
  }

  private pruneIfStillInvalid(planId: string, expectedRevision: string): void {
    this.mutate(document => {
      const current = document.records[planId];
      if (current && this.recordStatus(current, expectedRevision) !== 'valid') delete document.records[planId];
    });
  }

  private recordStatus(record: CacheRecord, expectedRevision: string): 'valid' | 'incompatible' | 'expired' {
    if (
      !record.provenance
      || record.provenance.application !== this.application
      || record.provenance.environment !== this.environment
      || record.provenance.planRevision !== expectedRevision
    ) return 'incompatible';
    const expiresAt = Date.parse(record.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return 'expired';
    return 'valid';
  }

  private mutate(change: (document: CacheDocument) => void): void {
    this.withLock(() => {
      const document = this.load();
      change(document);
      this.persist(document);
    });
  }

  private persist(document: CacheDocument): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(document, null, 2), 'utf8');
    replaceFileAtomic(temp, this.filePath);
  }

  private load(): CacheDocument {
    if (!fs.existsSync(this.filePath)) return emptyDocument();
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as unknown;
      if (isCacheDocument(parsed)) return parsed;
      // Legacy records intentionally remain untrusted because they lack environment/revision/expiry provenance.
      this.diagnostic('HEALING_CACHE_LEGACY_REJECTED', `Legacy healing cache at '${this.filePath}' will not be reused.`);
      return emptyDocument();
    } catch (error) {
      const quarantine = `${this.filePath}.corrupt-${Date.now()}`;
      try { fs.renameSync(this.filePath, quarantine); } catch { /* best effort quarantine */ }
      this.diagnostic('HEALING_CACHE_CORRUPT', `Malformed healing cache quarantined as '${quarantine}': ${error instanceof Error ? error.message : String(error)}`);
      return emptyDocument();
    }
  }

  private withLock<T>(operation: () => T): T {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const timeoutMs = positiveInteger(process.env.HEALING_CACHE_LOCK_TIMEOUT_MS, 2_000);
    const staleMs = positiveInteger(process.env.HEALING_CACHE_STALE_LOCK_MS, 30_000);
    const started = Date.now();
    while (true) {
      try {
        const fd = fs.openSync(this.lockPath, 'wx');
        try {
          fs.writeFileSync(fd, `${process.pid}\n${new Date().toISOString()}\n`);
          return operation();
        } finally {
          fs.closeSync(fd);
          fs.rmSync(this.lockPath, { force: true });
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        try {
          const age = Date.now() - fs.statSync(this.lockPath).mtimeMs;
          if (age > staleMs) {
            fs.rmSync(this.lockPath, { force: true });
            this.diagnostic('HEALING_CACHE_STALE_LOCK', `Removed stale cache lock older than ${staleMs}ms.`);
            continue;
          }
        } catch { /* lock disappeared between checks */ }
        if (Date.now() - started >= timeoutMs) {
          throw new Error(`HEALING_CACHE_LOCK_TIMEOUT: could not acquire '${this.lockPath}' within ${timeoutMs}ms.`);
        }
        sleepSync(20);
      }
    }
  }

  private diagnostic(code: string, message: string): void {
    console.warn(`[${code}] ${message}`);
  }
}

/** Returns the stable locator-plan revision used to invalidate incompatible healing cache entries. */
export function healingPlanRevision(plan: LocatorPlan): string { return planRevision(plan); }

function planRevision(plan: LocatorPlan): string {
  return crypto.createHash('sha256').update(JSON.stringify({
    id: plan.id,
    primary: plan.primary,
    fallbacks: plan.fallbacks ?? [],
    scope: plan.scope ?? null,
  })).digest('hex').slice(0, 20);
}

function resolveEnvironmentScope(application: string): string {
  const explicit = process.env.ENV?.trim();
  if (explicit) return safe(explicit);
  const stored = WorkspaceContext.read();
  if (stored?.application === application) return safe(stored.environment);
  const available = WorkspaceContext.listEnvironments(application);
  if (available.length === 1) return safe(available[0]!);
  throw new Error(`Environment scope is required for healing cache '${application}'. Set ENV or select a workspace environment.`);
}

function safe(value: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) throw new Error(`Invalid healing cache scope '${value}'.`);
  return value;
}

function positiveInteger(raw: string | undefined, fallback: number): number {
  const value = Number(raw ?? fallback);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function emptyDocument(): CacheDocument { return { schemaVersion: 2, records: {} }; }
function isCacheDocument(value: unknown): value is CacheDocument {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<CacheDocument>;
  return record.schemaVersion === 2 && Boolean(record.records) && typeof record.records === 'object' && !Array.isArray(record.records);
}
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function replaceFileAtomic(temp: string, target: string): void {
  try {
    fs.renameSync(temp, target);
  } catch (error) {
    if (process.platform === 'win32' && fs.existsSync(target)) {
      fs.rmSync(target, { force: true });
      fs.renameSync(temp, target);
      return;
    }
    try { fs.rmSync(temp, { force: true }); } catch { /* best effort */ }
    throw error;
  }
}
