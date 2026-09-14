import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { redact, sanitizeText } from '../logging/redactor.js';
import { ADOPTION_METRICS, type AdoptionObservation } from './adoption.types.js';

const VALID_METRICS = new Set<string>(ADOPTION_METRICS);
const METRIC_UNITS: Record<AdoptionObservation['metric'], AdoptionObservation['unit']> = {
  'authoring-session-minutes': 'minutes',
  'time-to-first-pass-minutes': 'minutes',
  'requirement-to-approved-test-minutes': 'minutes',
  'migration-minutes': 'minutes',
  'triage-minutes': 'minutes',
  'ci-wall-minutes': 'minutes',
  'ci-cost-usd': 'usd',
  'ai-cost-usd': 'usd',
  'report-completeness-percent': 'percent',
  'clean-pass-rate-percent': 'percent',
  'retry-pass-rate-percent': 'percent',
  'false-heal-rate-percent': 'percent',
};

/**
 * Immutable, environment-scoped pilot observation store.
 * Contributor keys are designed for opaque team aliases; direct email/whitespace identifiers are rejected and callers must not use personal names.
 */
export class AdoptionObservationStore {
  readonly root: string;
  readonly observationsDir: string;

  constructor(root: string) {
    this.root = path.resolve(root);
    this.observationsDir = path.join(this.root, 'observations');
  }

  static forScope(workspaceRoot: string, application: string, environment: string): AdoptionObservationStore {
    return new AdoptionObservationStore(path.join(workspaceRoot, '.report-history', safeSegment(application, 'application'), safeSegment(environment, 'environment'), 'adoption'));
  }

  /** Reads immutable pilot observations across representative applications for one environment. */
  static readWorkspace(workspaceRoot: string, environment?: string): AdoptionObservation[] {
    const historyRoot = path.join(path.resolve(workspaceRoot), '.report-history');
    if (!fs.existsSync(historyRoot)) return [];
    const observations: AdoptionObservation[] = [];
    for (const applicationEntry of fs.readdirSync(historyRoot, { withFileTypes: true })) {
      if (!applicationEntry.isDirectory() || applicationEntry.isSymbolicLink?.()) continue;
      const applicationRoot = path.join(historyRoot, applicationEntry.name);
      for (const environmentEntry of fs.readdirSync(applicationRoot, { withFileTypes: true })) {
        if (!environmentEntry.isDirectory() || environmentEntry.isSymbolicLink?.()) continue;
        if (environment && environmentEntry.name !== environment) continue;
        const store = AdoptionObservationStore.forScope(workspaceRoot, applicationEntry.name, environmentEntry.name);
        observations.push(...store.read());
      }
    }
    return observations.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id));
  }

  append(input: Omit<AdoptionObservation, 'schemaVersion' | 'id' | 'recordedAt'> & { id?: string; recordedAt?: string }): AdoptionObservation {
    return this.withLock(() => {
      const observation: AdoptionObservation = sanitizeObservation({
        ...input,
        schemaVersion: 1,
        id: input.id ?? `adoption-${randomUUID()}`,
        recordedAt: input.recordedAt ?? new Date().toISOString(),
      });
      validateObservation(observation);
      fs.mkdirSync(this.observationsDir, { recursive: true });
      const target = path.join(this.observationsDir, `${safeSegment(observation.id, 'observation id')}.json`);
      const serialized = `${JSON.stringify(observation, null, 2)}\n`;
      if (fs.existsSync(target)) {
        const existing = fs.readFileSync(target, 'utf8');
        if (sha(existing) !== sha(serialized)) throw new Error(`ADOPTION_OBSERVATION_CONFLICT: '${observation.id}' already exists with different content.`);
        return observation;
      }
      const fd = fs.openSync(target, 'wx', 0o600);
      try { fs.writeFileSync(fd, serialized, 'utf8'); } finally { fs.closeSync(fd); }
      this.exportJsonlUnlocked();
      return observation;
    });
  }

  read(): AdoptionObservation[] {
    if (!fs.existsSync(this.observationsDir)) return [];
    const result: AdoptionObservation[] = [];
    for (const file of fs.readdirSync(this.observationsDir).filter((name: string) => name.endsWith('.json')).sort()) {
      try {
        const parsed = JSON.parse(fs.readFileSync(path.join(this.observationsDir, file), 'utf8')) as AdoptionObservation;
        validateObservation(parsed);
        result.push(parsed);
      } catch { /* malformed evidence is never promoted into pilot metrics */ }
    }
    return result.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id));
  }

  exportJsonl(): string { return this.withLock(() => this.exportJsonlUnlocked()); }

  private exportJsonlUnlocked(): string {
    fs.mkdirSync(this.root, { recursive: true });
    const target = path.join(this.root, 'adoption-observations.jsonl');
    const body = this.read().map(item => JSON.stringify(item)).join('\n');
    atomicWrite(target, body ? `${body}\n` : '');
    return target;
  }

  private withLock<T>(operation: () => T): T {
    fs.mkdirSync(this.root, { recursive: true });
    const lock = path.join(this.root, '.adoption.lock');
    const timeoutMs = positiveInteger(process.env.ADOPTION_LOCK_TIMEOUT_MS, 2_000);
    const staleMs = positiveInteger(process.env.ADOPTION_STALE_LOCK_MS, 30_000);
    const started = Date.now();
    let fd: number | undefined;
    while (fd === undefined) {
      try {
        fd = fs.openSync(lock, 'wx', 0o600);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        try { if (Date.now() - fs.statSync(lock).mtimeMs > staleMs) { fs.rmSync(lock, { force: true }); continue; } } catch { /* disappeared */ }
        if (Date.now() - started >= timeoutMs) throw new Error(`ADOPTION_LOCK_TIMEOUT: ${lock}`);
        sleepSync(20);
        continue;
      }
      try {
        fs.writeFileSync(fd, `${process.pid}\n${new Date().toISOString()}\n`, 'utf8');
      } catch (error) {
        fs.closeSync(fd);
        fd = undefined;
        fs.rmSync(lock, { force: true });
        throw error;
      }
    }
    try { return operation(); }
    finally { fs.closeSync(fd); fs.rmSync(lock, { force: true }); }
  }
}

/** Returns the canonical unit required for a supported adoption metric. */
export function expectedUnit(metric: AdoptionObservation['metric']): AdoptionObservation['unit'] { return METRIC_UNITS[metric]; }

function sanitizeObservation(value: AdoptionObservation): AdoptionObservation {
  const cleaned = redact(value, { redactPii: true }) as AdoptionObservation;
  return {
    ...cleaned,
    note: cleaned.note ? sanitizeText(cleaned.note, { redactPii: true }).slice(0, 2_000) : undefined,
    evidenceRef: cleaned.evidenceRef ? sanitizeText(cleaned.evidenceRef, { redactPii: true }).slice(0, 500) : undefined,
  };
}

function validateObservation(value: AdoptionObservation): void {
  if (!value || value.schemaVersion !== 1) throw new Error('Unsupported adoption observation schema.');
  safeSegment(value.id, 'observation id');
  safeSegment(value.application, 'application');
  safeSegment(value.environment, 'environment');
  if (!VALID_METRICS.has(value.metric)) throw new Error(`Unsupported adoption metric '${value.metric}'.`);
  if (value.unit !== METRIC_UNITS[value.metric]) throw new Error(`Metric '${value.metric}' requires unit '${METRIC_UNITS[value.metric]}'.`);
  if (!Number.isFinite(value.value) || value.value < 0) throw new Error('Adoption observation value must be finite and non-negative.');
  if (value.baselineValue !== undefined && (!Number.isFinite(value.baselineValue) || value.baselineValue < 0)) throw new Error('Baseline value must be finite and non-negative.');
  if (value.unit === 'percent' && (value.value > 100 || (value.baselineValue ?? 0) > 100)) throw new Error('Percent observations must be between 0 and 100.');
  if (value.contributorKey) {
    if (value.contributorKey.includes('@') || /\s/.test(value.contributorKey) || !/^[A-Za-z0-9._-]{1,64}$/.test(value.contributorKey)) {
      throw new Error('contributorKey must be a non-PII opaque alias such as engineer-1.');
    }
  }
  if (!Number.isFinite(Date.parse(value.recordedAt))) throw new Error('recordedAt must be an ISO-compatible timestamp.');
}

function safeSegment(value: string, label: string): string {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized === '.' || normalized === '..' || !/^[A-Za-z0-9._-]+$/.test(normalized)) throw new Error(`Unsafe ${label}: '${value}'.`);
  return normalized;
}
function sha(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function positiveInteger(raw: string | undefined, fallback: number): number { const value = Number(raw ?? fallback); return Number.isInteger(value) && value > 0 ? value : fallback; }
function sleepSync(ms: number): void { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
function atomicWrite(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${randomBytes(3).toString('hex')}.tmp`;
  fs.writeFileSync(temp, content, { encoding: 'utf8', mode: 0o600 });
  try { fs.renameSync(temp, file); }
  catch (error) {
    if (process.platform === 'win32' && fs.existsSync(file)) { fs.rmSync(file, { force: true }); fs.renameSync(temp, file); return; }
    try { fs.rmSync(temp, { force: true }); } catch { /* best effort */ }
    throw error;
  }
}
