import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { ExecutionFacts, ReportHistoryPoint } from '../analytics/report.types';
import { resolveApplicationScope } from '../core/config/application.scope';
import { WorkspaceContext } from '../core/config/workspace.context';

/**
 * Author: Raushan Raj
 * Business Use: Maintains lightweight historical quality points for the dashboard trend chart.
 * How to use: Reporter appends local runs; CI should append only after shard reports are merged.
 * Benefit: Environment-scoped, lock-protected history avoids lost trend points when executions share a checkout.
 */
export class ReportHistoryStore {
  private readonly file: string;
  private readonly maxRuns: number;

  constructor(file = defaultHistoryFile()) {
    this.file = path.resolve(file);
    this.maxRuns = Math.max(5, positiveInteger(process.env.REPORT_HISTORY_MAX_RUNS, 30));
  }

  read(): ReportHistoryPoint[] {
    return readHistory(this.file);
  }

  append(facts: ExecutionFacts): ReportHistoryPoint[] {
    if (process.env.REPORT_HISTORY_ENABLED === 'false') return this.read();
    const current: ReportHistoryPoint = {
      runId: facts.runId,
      generatedAt: facts.generatedAt,
      environment: facts.environment,
      application: facts.application,
      total: facts.total,
      passed: facts.passed,
      failed: facts.failed,
      passRate: facts.passRate,
      flaky: facts.flakiness.flakyTests,
      healed: facts.healing.count,
      qualityPassRate: facts.qualityPassRate,
      qualityFailed: facts.qualityFailed,
      knownDefects: facts.knownDefects,
      unexpectedFailed: facts.unexpectedFailed,
      executed: facts.executed,
      applicable: facts.executionEligible,
      notApplicable: facts.notApplicable,
      blockedSkipped: facts.blockedSkipped
    };

    return withFileLock(this.file, () => {
      const previous = readHistory(this.file).filter(point => point.runId !== current.runId);
      const next = [...previous, current]
        .sort((a, b) => Date.parse(a.generatedAt) - Date.parse(b.generatedAt))
        .slice(-this.maxRuns);
      atomicWrite(this.file, JSON.stringify(next, null, 2));
      return next;
    });
  }
}

function defaultHistoryFile(): string {
  const override = process.env.REPORT_HISTORY_FILE?.trim();
  if (override) return override;
  const application = resolveApplicationScope();
  const environment = WorkspaceContext.resolveEnvironment(application);
  return path.join('.report-history', application, environment, 'business-history.json');
}

function readHistory(file: string): ReportHistoryPoint[] {
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as ReportHistoryPoint[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn(`[REPORT_HISTORY_CORRUPT] Ignoring malformed history '${file}': ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function withFileLock<T>(file: string, operation: () => T): T {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  const timeoutMs = positiveInteger(process.env.REPORT_HISTORY_LOCK_TIMEOUT_MS, 2_000);
  const staleMs = positiveInteger(process.env.REPORT_HISTORY_STALE_LOCK_MS, 30_000);
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
      if (Date.now() - started >= timeoutMs) throw new Error(`REPORT_HISTORY_LOCK_TIMEOUT: ${lock}`);
      sleepSync(20);
    }
  }
}

function atomicWrite(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  fs.writeFileSync(temp, content, 'utf8');
  replaceFile(temp, file);
}

function replaceFile(temp: string, target: string): void {
  try { fs.renameSync(temp, target); }
  catch (error) {
    if (process.platform === 'win32' && fs.existsSync(target)) {
      fs.rmSync(target, { force: true });
      fs.renameSync(temp, target);
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
function sleepSync(ms: number): void { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
