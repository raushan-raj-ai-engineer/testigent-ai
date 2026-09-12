import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { resolveApplicationScope } from '../core/config/application.scope';
import { WorkspaceContext } from '../core/config/workspace.context';

export interface DurationHistoryPoint {
  averageMs: number;
  samples: number;
  lastMs: number;
  lastSeenAt: string;
}

export interface DurationHistoryFile {
  schemaVersion: 1;
  updatedAt: string;
  tests: Record<string, DurationHistoryPoint>;
}

interface PendingObservation { sumMs: number; samples: number; lastMs: number; lastSeenAt: string }

/**
 * Author: Raushan Raj
 * Business Use: Maintains O(1)-lookup historical durations for optional duration-aware CI planning.
 * How to use: Reporter records observations; shard planner reads `estimateMs(key)`.
 * Benefit: Environment scope plus lock/merge publication prevents concurrent runs from losing duration observations.
 */
export class DurationHistoryStore {
  private data: DurationHistoryFile;
  private readonly pending = new Map<string, PendingObservation>();

  constructor(private readonly filePath = defaultDurationFile()) {
    this.data = this.load();
  }

  /** Records one duration using an incremental average, avoiding costly history-array scans. */
  record(key: string, durationMs: number): void {
    const normalizedKey = key.trim();
    if (!normalizedKey || !Number.isFinite(durationMs) || durationMs < 0) return;
    const rounded = Math.round(durationMs);
    const now = new Date().toISOString();
    const pending = this.pending.get(normalizedKey);
    this.pending.set(normalizedKey, pending
      ? { sumMs: pending.sumMs + rounded, samples: pending.samples + 1, lastMs: rounded, lastSeenAt: now }
      : { sumMs: rounded, samples: 1, lastMs: rounded, lastSeenAt: now });

    // Keep local estimates useful before save without assuming this in-memory copy is authoritative on disk.
    this.data.tests[normalizedKey] = mergeObservation(this.data.tests[normalizedKey], { sumMs: rounded, samples: 1, lastMs: rounded, lastSeenAt: now });
    this.data.updatedAt = now;
  }

  /** Returns a historical estimate or the supplied default when the test is new. */
  estimateMs(key: string, fallbackMs = 30_000): number {
    if (!Number.isFinite(fallbackMs) || fallbackMs < 0) throw new Error('Duration fallback must be a finite non-negative number.');
    const estimate = this.data.tests[key.trim()]?.averageMs;
    return Number.isFinite(estimate) && (estimate ?? -1) >= 0 ? estimate! : fallbackMs;
  }

  /** Lock-merges only this process's observations into the latest on-disk history, then atomically publishes. */
  save(): void {
    if (this.pending.size === 0) return;
    withFileLock(this.filePath, () => {
      const latest = this.load();
      for (const [key, observation] of this.pending) latest.tests[key] = mergeObservation(latest.tests[key], observation);
      latest.updatedAt = new Date().toISOString();
      atomicWrite(this.filePath, JSON.stringify(latest, null, 2));
      this.data = latest;
      this.pending.clear();
    });
  }

  /** Returns a defensive copy used by diagnostics and unit tests. */
  snapshot(): DurationHistoryFile { return JSON.parse(JSON.stringify(this.data)) as DurationHistoryFile; }

  private load(): DurationHistoryFile {
    if (!fs.existsSync(this.filePath)) return emptyHistory();
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Partial<DurationHistoryFile>;
      if (parsed.schemaVersion !== 1 || !parsed.tests || typeof parsed.tests !== 'object') throw new Error('unsupported schema');
      const tests = Object.fromEntries(Object.entries(parsed.tests).filter(([, point]) => isValidPoint(point)));
      return {
        schemaVersion: 1,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        tests,
      };
    } catch (error) {
      console.warn(`[DURATION_HISTORY_CORRUPT] Ignoring malformed history '${this.filePath}': ${error instanceof Error ? error.message : String(error)}`);
      return emptyHistory();
    }
  }
}

function defaultDurationFile(): string {
  const app = resolveApplicationScope();
  const env = WorkspaceContext.resolveEnvironment(app);
  return path.resolve('.report-history', app, env, 'execution-durations.json');
}

function mergeObservation(previous: DurationHistoryPoint | undefined, observation: PendingObservation): DurationHistoryPoint {
  const previousSamples = previous?.samples ?? 0;
  const samples = previousSamples + observation.samples;
  const totalMs = (previous?.averageMs ?? 0) * previousSamples + observation.sumMs;
  const previousTime = previous ? Date.parse(previous.lastSeenAt) : -1;
  const observationTime = Date.parse(observation.lastSeenAt);
  const useObservationLast = !previous || !Number.isFinite(previousTime) || observationTime >= previousTime;
  return {
    averageMs: Math.round(totalMs / samples),
    samples,
    lastMs: useObservationLast ? observation.lastMs : previous!.lastMs,
    lastSeenAt: useObservationLast ? observation.lastSeenAt : previous!.lastSeenAt,
  };
}

function withFileLock<T>(file: string, operation: () => T): T {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  const timeoutMs = positiveInteger(process.env.DURATION_HISTORY_LOCK_TIMEOUT_MS, 2_000);
  const staleMs = positiveInteger(process.env.DURATION_HISTORY_STALE_LOCK_MS, 30_000);
  const started = Date.now();
  while (true) {
    try {
      const fd = fs.openSync(lock, 'wx');
      try { fs.writeFileSync(fd, `${process.pid}\n${new Date().toISOString()}\n`); return operation(); }
      finally { fs.closeSync(fd); fs.rmSync(lock, { force: true }); }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      try { if (Date.now() - fs.statSync(lock).mtimeMs > staleMs) { fs.rmSync(lock, { force: true }); continue; } } catch { /* disappeared */ }
      if (Date.now() - started >= timeoutMs) throw new Error(`DURATION_HISTORY_LOCK_TIMEOUT: ${lock}`);
      sleepSync(20);
    }
  }
}

function atomicWrite(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  fs.writeFileSync(temp, content, 'utf8');
  try { fs.renameSync(temp, file); }
  catch (error) {
    if (process.platform === 'win32' && fs.existsSync(file)) { fs.rmSync(file, { force: true }); fs.renameSync(temp, file); return; }
    try { fs.rmSync(temp, { force: true }); } catch { /* best effort */ }
    throw error;
  }
}

function positiveInteger(raw: string | undefined, fallback: number): number {
  const value = Number(raw ?? fallback);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
function emptyHistory(): DurationHistoryFile { return { schemaVersion: 1, updatedAt: new Date(0).toISOString(), tests: {} }; }
function isValidPoint(value: unknown): value is DurationHistoryPoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as Partial<DurationHistoryPoint>;
  return Number.isFinite(point.averageMs) && (point.averageMs ?? -1) >= 0
    && Number.isInteger(point.samples) && (point.samples ?? 0) >= 1
    && Number.isFinite(point.lastMs) && (point.lastMs ?? -1) >= 0
    && typeof point.lastSeenAt === 'string';
}
function sleepSync(ms: number): void { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
