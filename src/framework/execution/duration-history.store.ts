import fs from 'node:fs';
import path from 'node:path';

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

/**
 * Author: Raushan Raj
 * Business Use: Maintains O(1)-lookup historical durations for optional duration-aware CI planning.
 * How to use: Reporter records observations; shard planner reads `estimateMs(key)`.
 * Benefit: Large suites can reduce long-tail shard imbalance without replacing Playwright's native scheduler.
 */
export class DurationHistoryStore {
  private readonly data: DurationHistoryFile;

  constructor(private readonly filePath = path.resolve('.report-history/execution-durations.json')) {
    this.data = this.load();
  }

  /** Records one duration using an incremental average, avoiding costly history-array scans. */
  record(key: string, durationMs: number): void {
    const normalizedKey = key.trim();
    if (!normalizedKey || !Number.isFinite(durationMs) || durationMs < 0) return;
    const previous = this.data.tests[normalizedKey];
    const samples = (previous?.samples ?? 0) + 1;
    const averageMs = previous
      ? Math.round(((previous.averageMs * previous.samples) + durationMs) / samples)
      : Math.round(durationMs);
    this.data.tests[normalizedKey] = { averageMs, samples, lastMs: Math.round(durationMs), lastSeenAt: new Date().toISOString() };
    this.data.updatedAt = new Date().toISOString();
  }

  /** Returns a historical estimate or the supplied default when the test is new. */
  estimateMs(key: string, fallbackMs = 30_000): number {
    if (!Number.isFinite(fallbackMs) || fallbackMs < 0) throw new Error('Duration fallback must be a finite non-negative number.');
    const estimate = this.data.tests[key.trim()]?.averageMs;
    return Number.isFinite(estimate) && (estimate ?? -1) >= 0 ? estimate! : fallbackMs;
  }

  /** Persists duration history atomically so interrupted writes do not corrupt the index. */
  save(): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp-${process.pid}`;
    fs.writeFileSync(temporary, JSON.stringify(this.data, null, 2));
    fs.renameSync(temporary, this.filePath);
  }

  /** Returns a defensive copy used by diagnostics and unit tests. */
  snapshot(): DurationHistoryFile { return JSON.parse(JSON.stringify(this.data)) as DurationHistoryFile; }

  private load(): DurationHistoryFile {
    if (!fs.existsSync(this.filePath)) return { schemaVersion: 1, updatedAt: new Date(0).toISOString(), tests: {} };
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Partial<DurationHistoryFile>;
      if (parsed.schemaVersion !== 1 || !parsed.tests || typeof parsed.tests !== 'object') throw new Error('unsupported schema');
      const tests = Object.fromEntries(Object.entries(parsed.tests).filter(([, point]) => isValidPoint(point)));
      return {
        schemaVersion: 1,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
        tests,
      };
    } catch {
      const backup = `${this.filePath}.corrupt-${Date.now()}`;
      try { fs.renameSync(this.filePath, backup); } catch { /* best effort */ }
      return { schemaVersion: 1, updatedAt: new Date(0).toISOString(), tests: {} };
    }
  }
}


function isValidPoint(value: unknown): value is DurationHistoryPoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as Partial<DurationHistoryPoint>;
  return Number.isFinite(point.averageMs) && (point.averageMs ?? -1) >= 0
    && Number.isInteger(point.samples) && (point.samples ?? 0) >= 1
    && Number.isFinite(point.lastMs) && (point.lastMs ?? -1) >= 0
    && typeof point.lastSeenAt === 'string';
}
