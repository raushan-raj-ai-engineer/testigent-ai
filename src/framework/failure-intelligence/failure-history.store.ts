import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { FailureClassification } from './failure-intelligence.types.js';

export interface FailureHistoryOccurrence {
  schemaVersion: 1;
  occurrenceId: string;
  runId: string;
  attempt: number;
  environment?: string;
  project?: string;
  recordedAt: string;
  classification: FailureClassification;
}
export interface FailureOccurrenceContext { runId: string; attempt?: number; environment?: string; project?: string; recordedAt?: string; occurrenceId?: string; }

/** Immutable occurrence store. Incident identity is separate from run/attempt occurrence identity. */
export class FailureHistoryStore {
  constructor(readonly root: string) {}
  static forScope(workspaceRoot: string, application: string, environment: string): FailureHistoryStore {
    return new FailureHistoryStore(path.join(workspaceRoot, '.report-history', safe(application), safe(environment)));
  }

  append(record: FailureClassification, context: FailureOccurrenceContext): string {
    if (record.evidenceMode !== 'LIVE' || record.synthetic || !record.claimEligible) throw new Error('FAILURE_HISTORY_TRUST_BOUNDARY: only claim-eligible LIVE evidence may enter production history.');
    if (!context.runId?.trim()) throw new Error('FAILURE_HISTORY_OCCURRENCE: runId is required.');
    const attempt = Number.isInteger(context.attempt) && (context.attempt ?? 0) >= 0 ? context.attempt! : 0;
    const occurrenceId = context.occurrenceId ?? occurrenceIdentity(context.runId, attempt, record.scenarioId, record.fingerprint);
    const occurrence: FailureHistoryOccurrence = {
      schemaVersion: 1, occurrenceId, runId: context.runId, attempt,
      ...(context.environment ? { environment: context.environment } : {}), ...(context.project ? { project: context.project } : {}),
      recordedAt: context.recordedAt ?? new Date().toISOString(), classification: record,
    };
    validateOccurrence(occurrence);
    const dir = path.join(this.root, 'failure-intelligence', 'live'); fs.mkdirSync(dir, { recursive: true });
    const target = path.join(dir, `${safe(record.fingerprint)}-${safe(record.scenarioId)}-${safe(occurrenceId)}.json`);
    const body = `${JSON.stringify(occurrence, null, 2)}\n`;
    return withRecordLock(`${target}.lock`, () => {
      if (fs.existsSync(target)) {
        const existing = fs.readFileSync(target, 'utf8');
        if (canonicalOccurrence(existing) !== canonicalOccurrence(body)) throw new Error(`FAILURE_HISTORY_CONFLICT: immutable occurrence '${path.basename(target)}' differs.`);
        return target;
      }
      atomicCreate(target, body);
      return target;
    });
  }

  readOccurrences(): FailureHistoryOccurrence[] {
    const dir = path.join(this.root, 'failure-intelligence', 'live'); if (!fs.existsSync(dir)) return [];
    const output: FailureHistoryOccurrence[] = [];
    for (const name of fs.readdirSync(dir).filter(name => name.endsWith('.json')).sort()) {
      const file = path.join(dir, name);
      try { const item = JSON.parse(fs.readFileSync(file, 'utf8')) as FailureHistoryOccurrence; validateOccurrence(item); output.push(item); }
      catch (cause) { throw new Error(`FAILURE_HISTORY_CORRUPT: ${file}: ${cause instanceof Error ? cause.message : String(cause)}`); }
    }
    return output.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.occurrenceId.localeCompare(b.occurrenceId));
  }
  /** Compatibility view for existing consumers. */
  read(): FailureClassification[] { return this.readOccurrences().map(item => item.classification); }
  similarOccurrences(fingerprint: string): FailureHistoryOccurrence[] { return this.readOccurrences().filter(item => item.classification.fingerprint === fingerprint); }
  similar(fingerprint: string): FailureClassification[] { return this.similarOccurrences(fingerprint).map(item => item.classification); }
}

function validateOccurrence(value: FailureHistoryOccurrence): void {
  if (!value || value.schemaVersion !== 1 || !value.occurrenceId || !value.runId || !Number.isInteger(value.attempt) || value.attempt < 0 || !Number.isFinite(Date.parse(value.recordedAt))) throw new Error('invalid occurrence schema');
  const record = value.classification;
  if (!record || record.evidenceMode !== 'LIVE' || record.synthetic !== false || record.claimEligible !== true) throw new Error('untrusted occurrence classification');
}
function occurrenceIdentity(runId: string, attempt: number, scenarioId: string, fingerprint: string): string { return createHash('sha256').update(`${runId}\0${attempt}\0${scenarioId}\0${fingerprint}`).digest('hex').slice(0, 20); }
function canonicalOccurrence(body: string): string { const parsed = JSON.parse(body) as FailureHistoryOccurrence; return JSON.stringify({ ...parsed, recordedAt: '<ignored-for-idempotent-replay>' }); }
function withRecordLock<T>(lock: string, operation: () => T): T { const timeoutMs = positiveInteger(process.env.FAILURE_HISTORY_LOCK_TIMEOUT_MS, 2_000); const staleMs = positiveInteger(process.env.FAILURE_HISTORY_STALE_LOCK_MS, 30_000); const started = Date.now(); let handle: number | undefined; while (handle === undefined) { try { handle = fs.openSync(lock, 'wx', 0o600); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; try { if (Date.now() - fs.statSync(lock).mtimeMs > staleMs) { fs.rmSync(lock, { force: true }); continue; } } catch { /* disappeared */ } if (Date.now() - started >= timeoutMs) throw new Error(`FAILURE_HISTORY_LOCK_TIMEOUT: ${lock}`); sleepSync(20); } } try { return operation(); } finally { fs.closeSync(handle); fs.rmSync(lock, { force: true }); } }
function safe(value: string): string { const normalized = String(value ?? '').trim(); if (!normalized || normalized === '.' || normalized === '..') throw new Error(`Unsafe history segment '${value}'.`); return normalized.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 120); }
function positiveInteger(raw: string | undefined, fallback: number): number { const value = Number(raw ?? fallback); return Number.isInteger(value) && value > 0 ? value : fallback; }
function sleepSync(ms: number): void { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

function atomicCreate(file: string, content: string): void {
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  let handle: number | undefined;
  try {
    handle = fs.openSync(temp, 'wx', 0o600);
    fs.writeFileSync(handle, content, 'utf8');
    fs.fsyncSync(handle);
    fs.closeSync(handle); handle = undefined;
    fs.renameSync(temp, file);
  } catch (error) {
    if (handle !== undefined) try { fs.closeSync(handle); } catch { /* best effort */ }
    try { fs.rmSync(temp, { force: true }); } catch { /* best effort */ }
    throw error;
  }
}
