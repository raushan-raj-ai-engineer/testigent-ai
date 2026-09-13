import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { resolveApplicationScope } from '../core/config/application.scope';
import { WorkspaceContext } from '../core/config/workspace.context';
import { sanitizeText } from '../logging/redactor';

export type AiProviderCanaryStatus = 'HEALTHY' | 'DEGRADED' | 'MISCONFIGURED' | 'SKIPPED';
export type AiProviderCheckOutcome = 'passed' | 'failed' | 'skipped';

export interface AiProviderCanaryRecord {
  runId: string;
  workflowRunId?: string;
  attempt?: number;
  application: string;
  environment: string;
  recordedAt: string;
  status: AiProviderCanaryStatus;
  providerMode: string;
  providers: string[];
  model?: string;
  configurationOutcome: AiProviderCheckOutcome;
  providerCheckOutcome: AiProviderCheckOutcome;
  healingOutcome: AiProviderCheckOutcome;
  healthLatencyMs?: number;
  generationLatencyMs?: number;
  healingLatencyMs?: number;
  errorKind?: string;
  errorMessage?: string;
}


const CANARY_STATUSES = new Set<AiProviderCanaryStatus>(['HEALTHY', 'DEGRADED', 'MISCONFIGURED', 'SKIPPED']);
const CHECK_OUTCOMES = new Set<AiProviderCheckOutcome>(['passed', 'failed', 'skipped']);

/**
 * Author: Raushan Raj
 * Business Use: Validates live AI provider canary evidence before it can influence provider-health reporting or AI evidence selection.
 * How to use: Call this type guard whenever canary JSON is loaded from CI artifacts or persisted provider-health history.
 * Benefit: Malformed, contradictory, or incomplete provider evidence fails closed instead of being trusted as healthy operational evidence.
 */
export function isAiProviderCanaryRecord(value: unknown): value is AiProviderCanaryRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<AiProviderCanaryRecord>;
  if (!record.runId?.trim() || !record.application?.trim() || !record.environment?.trim() || !record.recordedAt?.trim()) return false;
  if (!Number.isFinite(Date.parse(record.recordedAt))) return false;
  if (!record.status || !CANARY_STATUSES.has(record.status)) return false;
  if (!record.providerMode?.trim() || !Array.isArray(record.providers) || !record.providers.every(item => typeof item === 'string' && item.trim().length > 0)) return false;
  if (record.workflowRunId !== undefined && !record.workflowRunId.trim()) return false;
  if (record.model !== undefined && !record.model.trim()) return false;
  if (!record.configurationOutcome || !CHECK_OUTCOMES.has(record.configurationOutcome)) return false;
  if (!record.providerCheckOutcome || !CHECK_OUTCOMES.has(record.providerCheckOutcome)) return false;
  if (!record.healingOutcome || !CHECK_OUTCOMES.has(record.healingOutcome)) return false;
  if (record.attempt !== undefined && (!Number.isInteger(record.attempt) || record.attempt <= 0)) return false;
  for (const latency of [record.healthLatencyMs, record.generationLatencyMs, record.healingLatencyMs]) {
    if (latency !== undefined && (!Number.isFinite(latency) || latency < 0)) return false;
  }

  // Final canary state must agree with the underlying step outcomes. This prevents a malformed
  // artifact from declaring HEALTHY while carrying failed/skipped provider or healing evidence.
  if (record.status === 'HEALTHY') {
    if (record.configurationOutcome !== 'passed' || record.providerCheckOutcome !== 'passed' || record.healingOutcome !== 'passed' || record.providers.length === 0) return false;
  } else if (record.status === 'MISCONFIGURED') {
    if (record.configurationOutcome !== 'failed') return false;
  } else if (record.status === 'DEGRADED') {
    if (record.configurationOutcome !== 'passed') return false;
    if (record.providerCheckOutcome !== 'failed' && record.healingOutcome !== 'failed') return false;
  }
  return true;
}

export interface AiProviderHealthSummary {
  status: AiProviderCanaryStatus;
  latest?: AiProviderCanaryRecord;
  samples: number;
  healthySamples: number;
  degradedSamples: number;
  availabilityPercent: number | null;
  averageGenerationLatencyMs: number | null;
  recent: AiProviderCanaryRecord[];
}

/**
 * Author: Raushan Raj
 * Business Use: Keeps a small environment-scoped history of live AI provider canary outcomes.
 * How to use: CI appends the latest canary after report-history restore; the business dashboard reads the same store.
 * Benefit: Provider availability remains visible and auditable without turning third-party outages into framework correctness claims.
 */
export class AiProviderHealthStore {
  private readonly file: string;
  private readonly maxRuns: number;

  constructor(file = defaultHealthFile()) {
    this.file = path.resolve(file);
    this.maxRuns = Math.max(5, positiveInteger(process.env.AI_PROVIDER_HEALTH_MAX_RUNS, 30));
  }

  read(): AiProviderCanaryRecord[] {
    return readRecords(this.file);
  }

  append(record: AiProviderCanaryRecord): AiProviderCanaryRecord[] {
    if (!isAiProviderCanaryRecord(record)) throw new Error('AI_PROVIDER_CANARY_INVALID: refusing malformed provider-health evidence.');
    return withFileLock(this.file, () => {
      const dedupeKey = recordKey(record);
      const previous = readRecords(this.file).filter(item => recordKey(item) !== dedupeKey);
      const next = [...previous, sanitizeRecord(record)]
        .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt))
        .slice(-this.maxRuns);
      atomicWrite(this.file, JSON.stringify(next, null, 2));
      return next;
    });
  }

  summary(): AiProviderHealthSummary {
    return summarizeAiProviderHealth(this.read());
  }
}

/**
 * Author: Raushan Raj
 * Business Use: Converts validated AI provider canary history into deterministic operational health facts for reporting.
 * How to use: Pass environment-scoped canary records after runtime validation; AiProviderHealthStore.summary() uses this function automatically.
 * Benefit: Stakeholders see provider availability and latency trends without allowing external AI outages to rewrite deterministic release-quality facts.
 */
export function summarizeAiProviderHealth(records: AiProviderCanaryRecord[]): AiProviderHealthSummary {
  const recent = [...records].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
  const eligible = recent.filter(item => item.status === 'HEALTHY' || item.status === 'DEGRADED');
  const healthy = eligible.filter(item => item.status === 'HEALTHY');
  const latencies = eligible.map(item => item.generationLatencyMs).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const latest = recent[0];
  return {
    status: latest?.status ?? 'SKIPPED',
    latest,
    samples: eligible.length,
    healthySamples: healthy.length,
    degradedSamples: eligible.length - healthy.length,
    availabilityPercent: eligible.length ? Math.round((healthy.length / eligible.length) * 1000) / 10 : null,
    averageGenerationLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null,
    recent: recent.slice(0, 10)
  };
}

function defaultHealthFile(): string {
  const override = process.env.AI_PROVIDER_HEALTH_FILE?.trim();
  if (override) return override;
  const application = resolveApplicationScope();
  const environment = WorkspaceContext.resolveEnvironment(application);
  return path.join('.report-history', application, environment, 'ai-provider-health.json');
}

function readRecords(file: string): AiProviderCanaryRecord[] {
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isAiProviderCanaryRecord).map(sanitizeRecord) : [];
  } catch (error) {
    console.warn(`[AI_PROVIDER_HEALTH_CORRUPT] Ignoring malformed history '${file}': ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function sanitizeRecord(record: AiProviderCanaryRecord): AiProviderCanaryRecord {
  const clean = (value?: string) => value === undefined ? undefined : sanitizeText(value).replace(/[\r\n\t]+/g, ' ').trim().slice(0, 300);
  return {
    ...record,
    providers: (record.providers ?? []).map(item => clean(item) ?? '').filter(Boolean).slice(0, 5),
    model: clean(record.model),
    errorKind: clean(record.errorKind),
    errorMessage: clean(record.errorMessage)
  };
}

function recordKey(record: AiProviderCanaryRecord): string {
  return `${record.runId}|${record.attempt ?? ''}`;
}

function withFileLock<T>(file: string, operation: () => T): T {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  const timeoutMs = positiveInteger(process.env.AI_PROVIDER_HEALTH_LOCK_TIMEOUT_MS, 2_000);
  const staleMs = positiveInteger(process.env.AI_PROVIDER_HEALTH_STALE_LOCK_MS, 30_000);
  const started = Date.now();
  while (true) {
    try {
      const fd = fs.openSync(lock, 'wx');
      try {
        fs.writeFileSync(fd, `${process.pid}\n${new Date().toISOString()}\n`);
        return operation();
      } finally {
        fs.closeSync(fd);
        fs.rmSync(lock, { force: true });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > staleMs) { fs.rmSync(lock, { force: true }); continue; }
      } catch { /* lock disappeared */ }
      if (Date.now() - started >= timeoutMs) throw new Error(`AI_PROVIDER_HEALTH_LOCK_TIMEOUT: ${lock}`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
}

function atomicWrite(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  fs.writeFileSync(temp, content, 'utf8');
  try { fs.renameSync(temp, file); }
  catch (error) {
    if (process.platform === 'win32' && fs.existsSync(file)) {
      fs.rmSync(file, { force: true });
      fs.renameSync(temp, file);
      return;
    }
    try { fs.rmSync(temp, { force: true }); } catch { /* best effort */ }
    throw error;
  }
}

function positiveInteger(raw: string | undefined, fallback: number): number {
  const value = Number(raw ?? fallback);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
