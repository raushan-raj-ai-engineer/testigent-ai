import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { WorkspaceContext } from './workspace.context';

export interface RunContextData {
  runId: string;
  startedAt?: string;
  application?: string;
  environment?: string;
  pid?: number;
}

/**
 * Immutable execution identity. RUN_ID is established before Playwright config/report paths are resolved,
 * inherited by workers, and persisted in a run-specific file. A separate latest pointer is convenience only
 * and is never used as the identity of an already-running process.
 */
export class RunContext {
  static ensure(root = process.cwd(), env: NodeJS.ProcessEnv = process.env): RunContextData {
    const existing = env.RUN_ID?.trim();
    const runId = existing || this.createRunId(env);
    const startedAt = env.RUN_STARTED_AT?.trim() || new Date().toISOString();
    assertSafeRunId(runId);
    env.RUN_ID = runId;
    env.RUN_STARTED_AT = startedAt;
    return { runId, startedAt, pid: process.pid };
  }

  static get(root = process.cwd(), env: NodeJS.ProcessEnv = process.env): RunContextData {
    const runId = env.RUN_ID?.trim();
    if (runId) {
      assertSafeRunId(runId);
      const file = this.runFile(runId, root);
      if (fs.existsSync(file)) {
        try { return { ...JSON.parse(fs.readFileSync(file, 'utf8')) as RunContextData, runId }; } catch { /* use env identity */ }
      }
      return { runId, startedAt: env.RUN_STARTED_AT, pid: process.pid };
    }
    return { runId: 'unresolved-run' };
  }

  static persistCurrent(root = process.cwd(), env: NodeJS.ProcessEnv = process.env): RunContextData {
    const base = this.ensure(root, env);
    const target = WorkspaceContext.resolve({ root, env });
    const data: RunContextData = { ...base, application: target.application, environment: target.environment, pid: process.pid };
    atomicJson(this.runFile(data.runId, root), data);
    atomicJson(this.latestFile(target.application, target.environment, root), data);
    return data;
  }

  static latest(application: string, environment: string, root = process.cwd()): RunContextData | undefined {
    const file = this.latestFile(application, environment, root);
    if (!fs.existsSync(file)) return undefined;
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as RunContextData;
      if (!parsed.runId) return undefined;
      assertSafeRunId(parsed.runId);
      return parsed;
    } catch {
      return undefined;
    }
  }

  static runFile(runId: string, root = process.cwd()): string {
    assertSafeRunId(runId);
    return path.resolve(root, '.runtime', 'runs', `${runId}.json`);
  }

  static latestFile(application: string, environment: string, root = process.cwd()): string {
    return path.resolve(root, '.runtime', 'latest-run', safeSegment(application), `${safeSegment(environment)}.json`);
  }

  private static createRunId(env: NodeJS.ProcessEnv): string {
    if (env.GITHUB_RUN_ID) return `github-${safeSegment(env.GITHUB_RUN_ID)}-${safeSegment(env.GITHUB_RUN_ATTEMPT ?? '1')}`;
    if (env.BUILD_BUILDID) return `azure-${safeSegment(env.BUILD_BUILDID)}`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `local-${timestamp}-${process.pid}-${crypto.randomBytes(3).toString('hex')}`;
  }
}

/** Rejects run identifiers that could escape or ambiguously address run-scoped artifact directories. */
export function assertSafeRunId(value: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)) {
    throw new Error(`Invalid RUN_ID '${value}'. Use 1-128 letters, numbers, dot, underscore or dash.`);
  }
}

function safeSegment(value: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(trimmed)) throw new Error(`Invalid path segment '${value}'.`);
  return trimmed;
}

function atomicJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  replaceFileAtomic(tmp, file);
}

function replaceFileAtomic(tmp: string, target: string): void {
  try {
    fs.renameSync(tmp, target);
  } catch (error) {
    // Windows does not always replace an existing target atomically. Remove only after the
    // completed temporary file exists; the next persist recreates the convenience pointer.
    if (process.platform === 'win32' && fs.existsSync(target)) {
      fs.rmSync(target, { force: true });
      fs.renameSync(tmp, target);
      return;
    }
    try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ }
    throw error;
  }
}

