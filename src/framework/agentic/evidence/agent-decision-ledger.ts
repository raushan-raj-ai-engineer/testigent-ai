import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { redact, sanitizeText } from '../../logging/redactor.js';
import type { AgentDecisionInput, AgentDecisionRecord, AgenticOperationalState, AgentKind } from '../contracts/agent.types.js';
import { AGENTIC_OPERATIONAL_STATES } from '../contracts/agent.types.js';

export interface AgenticIntelligenceSummary {
  status: AgenticOperationalState | 'NO_ACTIVITY';
  decisions: number;
  trusted: number;
  rejected: number;
  reviewRequired: number;
  insufficientEvidence: number;
  degraded: number;
  agents: Record<AgentKind, number>;
  latestAt?: string;
}

function safeSegment(value: string, label: string): string {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9._-]+$/.test(normalized)) throw new Error(`Unsafe ${label}: '${value}'.`);
  return normalized;
}
const VALID_AGENT_KINDS = new Set<AgentKind>(['planner', 'generator', 'reviewer', 'healer', 'mcp']);

function positiveInteger(raw: string | undefined, fallback: number): number {
  const value = Number(raw ?? fallback);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function withLedgerLock<T>(root: string, operation: () => T): T {
  fs.mkdirSync(root, { recursive: true });
  const lock = path.join(root, '.agent-decision-ledger.lock');
  const timeoutMs = positiveInteger(process.env.AGENTIC_LEDGER_LOCK_TIMEOUT_MS, 2_000);
  const staleMs = positiveInteger(process.env.AGENTIC_LEDGER_STALE_LOCK_MS, 30_000);
  const started = Date.now();

  while (true) {
    let fd: number;

    try {
      fd = fs.openSync(lock, 'wx', 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;

      try {
        if (Date.now() - fs.statSync(lock).mtimeMs > staleMs) {
          fs.rmSync(lock, { force: true });
          continue;
        }
      } catch {
        // Lock disappeared between checks; retry acquisition.
      }

      if (Date.now() - started >= timeoutMs) {
        throw new Error(`AGENTIC_LEDGER_LOCK_TIMEOUT: ${lock}`);
      }

      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
      continue;
    }

    try {
      fs.writeFileSync(fd, `${process.pid}\n${new Date().toISOString()}\n`);
      return operation();
    } finally {
      fs.closeSync(fd);
      fs.rmSync(lock, { force: true });
    }
  }
}

function atomicWrite(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  fs.writeFileSync(temp, content, 'utf8');

  try {
    fs.renameSync(temp, file);
  } catch (error) {
    if (process.platform === 'win32' && fs.existsSync(file)) {
      fs.rmSync(file, { force: true });
      fs.renameSync(temp, file);
      return;
    }

    try {
      fs.rmSync(temp, { force: true });
    } catch {
      // Best-effort cleanup only.
    }

    throw error;
  }
}

function validState(value: unknown): value is AgenticOperationalState { return typeof value === 'string' && (AGENTIC_OPERATIONAL_STATES as readonly string[]).includes(value); }
function validAgent(value: unknown): value is AgentKind { return typeof value === 'string' && VALID_AGENT_KINDS.has(value as AgentKind); }
function validRecord(value: unknown): value is AgentDecisionRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<AgentDecisionRecord>;
  return record.version === 1 && typeof record.id === 'string' && typeof record.runId === 'string' && typeof record.application === 'string' && typeof record.environment === 'string' && typeof record.timestamp === 'string' && validAgent(record.agent) && typeof record.operation === 'string' && validState(record.state) && Array.isArray(record.evidence) && Array.isArray(record.affectedArtifacts);
}

/** Immutable, run-scoped decision ledger used to preserve sanitized agentic provenance and reporting evidence. */
export class AgentDecisionLedger {
  readonly root: string;
  readonly decisionsDir: string;

  constructor(root: string) {
    this.root = path.resolve(root);
    this.decisionsDir = path.join(this.root, 'decisions');
  }

  /** Creates a ledger path under reports/<app>/<env>/<run>/agentic without requiring mutable global state. */
  static forRun(workspaceRoot: string, application: string, environment: string, runId: string): AgentDecisionLedger {
    return new AgentDecisionLedger(path.join(workspaceRoot, 'reports', safeSegment(application, 'application'), safeSegment(environment, 'environment'), safeSegment(runId, 'run id'), 'agentic'));
  }

  /** Appends one sanitized immutable decision; a conflicting duplicate id fails closed. */
  append(input: AgentDecisionInput): AgentDecisionRecord {
    const timestamp = input.timestamp ?? new Date().toISOString();
    const id = input.id ?? `decision-${randomUUID()}`;
    safeSegment(id, 'decision id');
    const sanitized = redact({ ...input, version: 1 as const, id, timestamp }, { redactPii: true }) as AgentDecisionRecord;
    sanitized.rationale = sanitizeText(sanitized.rationale, { redactPii: true }).slice(0, 4_000);
    if (!validRecord(sanitized)) throw new Error('Invalid agent decision record rejected by ledger contract.');
    fs.mkdirSync(this.decisionsDir, { recursive: true });

    return withLedgerLock(this.root, () => {
      const target = path.join(this.decisionsDir, `${id}.json`);
      const serialized = `${JSON.stringify(sanitized, null, 2)}\n`;

      if (fs.existsSync(target)) {
        const existing = fs.readFileSync(target, 'utf8');
        if (createHash('sha256').update(existing).digest('hex') !== createHash('sha256').update(serialized).digest('hex')) {
          throw new Error(`AGENT_DECISION_CONFLICT: immutable decision '${id}' already exists with different content.`);
        }

        this.exportJsonlUnlocked();
        return sanitized;
      }

      const handle = fs.openSync(target, 'wx', 0o600);
      try {
        fs.writeFileSync(handle, serialized, 'utf8');
      } finally {
        fs.closeSync(handle);
      }

      this.exportJsonlUnlocked();
      return sanitized;
    });
  }

  /** Reads only schema-valid decisions and ignores unrelated/corrupt files instead of treating them as trusted evidence. */
  read(): AgentDecisionRecord[] {
    if (!fs.existsSync(this.decisionsDir)) return [];
    const records: AgentDecisionRecord[] = [];
    for (const file of fs.readdirSync(this.decisionsDir).filter((name: string) => name.endsWith('.json')).sort()) {
      try {
        const parsed = JSON.parse(fs.readFileSync(path.join(this.decisionsDir, file), 'utf8')) as unknown;
        if (validRecord(parsed)) records.push(parsed);
      } catch { /* corrupt records are never promoted into reporting evidence */ }
    }
    return records.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id));
  }

  /** Produces a deterministic compact summary for the business dashboard. */
  summary(): AgenticIntelligenceSummary {
    const records = this.read();
    const agents: Record<AgentKind, number> = { planner: 0, generator: 0, reviewer: 0, healer: 0, mcp: 0 };
    for (const record of records) agents[record.agent] += 1;
    const status: AgenticIntelligenceSummary['status'] = records.length === 0 ? 'NO_ACTIVITY'
      : records.some(record => record.state === 'REJECTED') ? 'REJECTED'
      : records.some(record => record.state === 'DEGRADED') ? 'DEGRADED'
      : records.some(record => record.state === 'INSUFFICIENT_EVIDENCE') ? 'INSUFFICIENT_EVIDENCE'
      : records.some(record => record.state === 'REVIEW_REQUIRED') ? 'REVIEW_REQUIRED'
      : records.every(record => record.state === 'SKIPPED') ? 'SKIPPED'
      : 'ACCEPTED';
    return {
      status,
      decisions: records.length,
      trusted: records.filter(record => record.state === 'ACCEPTED').length,
      rejected: records.filter(record => record.state === 'REJECTED').length,
      reviewRequired: records.filter(record => record.state === 'REVIEW_REQUIRED').length,
      insufficientEvidence: records.filter(record => record.state === 'INSUFFICIENT_EVIDENCE').length,
      degraded: records.filter(record => record.state === 'DEGRADED').length,
      agents,
      ...(records.at(-1)?.timestamp ? { latestAt: records.at(-1)!.timestamp } : {}),
    };
  }

  /** Regenerates the convenient JSONL view from immutable decision files. */
  exportJsonl(): string {
    return withLedgerLock(this.root, () => this.exportJsonlUnlocked());
  }

  private exportJsonlUnlocked(): string {
    fs.mkdirSync(this.root, { recursive: true });
    const target = path.join(this.root, 'agent-decision-ledger.jsonl');
    const body = this.read().map(record => JSON.stringify(record)).join('\n');
    atomicWrite(target, body ? `${body}\n` : '');
    return target;
  }

}
