import fs from 'node:fs';
import path from 'node:path';
import type { FailureClassification } from './failure-intelligence.types.js';

/** Immutable classification history store; SHOWCASE evidence is isolated from live history by construction. */
export class FailureHistoryStore {
  constructor(readonly root: string) {}

  /** Appends one immutable live classification with a bounded record lock for concurrent writers. */
  append(record: FailureClassification): string {
    if (record.evidenceMode !== 'LIVE' || record.synthetic || !record.claimEligible) {
      throw new Error('FAILURE_HISTORY_TRUST_BOUNDARY: only claim-eligible LIVE evidence may enter production history.');
    }
    const dir = path.join(this.root, 'failure-intelligence', 'live');
    fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, `${safe(record.fingerprint)}-${safe(record.scenarioId)}.json`);
    const body = `${JSON.stringify(record, null, 2)}\n`;
    return withRecordLock(`${target}.lock`, () => {
      if (fs.existsSync(target)) {
        if (fs.readFileSync(target, 'utf8') !== body) throw new Error(`FAILURE_HISTORY_CONFLICT: immutable evidence '${path.basename(target)}' differs.`);
        return target;
      }
      const handle = fs.openSync(target, 'wx', 0o600);
      try { fs.writeFileSync(handle, body, 'utf8'); } finally { fs.closeSync(handle); }
      return target;
    });
  }

  /** Reads valid live history for correlation without mutating classification truth. */
  read(): FailureClassification[] {
    const dir = path.join(this.root, 'failure-intelligence', 'live');
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((name: string) => name.endsWith('.json')).sort().flatMap((name: string) => {
      try {
        const item = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as FailureClassification;
        return item.evidenceMode === 'LIVE' && item.synthetic === false && item.claimEligible === true ? [item] : [];
      } catch { return []; }
    });
  }

  /** Finds prior live classifications for one stable failure fingerprint. */
  similar(fingerprint: string): FailureClassification[] { return this.read().filter(item => item.fingerprint === fingerprint); }
}

function withRecordLock<T>(lock: string, operation: () => T): T {
  const timeoutMs = positiveInteger(process.env.FAILURE_HISTORY_LOCK_TIMEOUT_MS, 2_000);
  const staleMs = positiveInteger(process.env.FAILURE_HISTORY_STALE_LOCK_MS, 30_000);
  const started = Date.now();
  let handle: number | undefined;
  while (handle === undefined) {
    try { handle = fs.openSync(lock, 'wx', 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      try { if (Date.now() - fs.statSync(lock).mtimeMs > staleMs) { fs.rmSync(lock, { force: true }); continue; } } catch { /* lock disappeared */ }
      if (Date.now() - started >= timeoutMs) throw new Error(`FAILURE_HISTORY_LOCK_TIMEOUT: ${lock}`);
      sleepSync(20);
    }
  }
  try { return operation(); }
  finally { fs.closeSync(handle); fs.rmSync(lock, { force: true }); }
}

function safe(value: string): string { return value.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 120); }
function positiveInteger(raw: string | undefined, fallback: number): number { const value = Number(raw ?? fallback); return Number.isInteger(value) && value > 0 ? value : fallback; }
function sleepSync(ms: number): void { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
