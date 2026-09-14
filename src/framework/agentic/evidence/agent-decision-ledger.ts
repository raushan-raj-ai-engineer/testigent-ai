import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
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
  if (!normalized || normalized === '.' || normalized === '..' || !/^[A-Za-z0-9._-]+$/.test(normalized)) throw new Error(`Unsafe ${label}: '${value}'.`);
  return normalized;
}
const VALID_AGENT_KINDS = new Set<AgentKind>(['planner', 'generator', 'reviewer', 'healer', 'mcp']);

function validState(value: unknown): value is AgenticOperationalState { return typeof value === 'string' && (AGENTIC_OPERATIONAL_STATES as readonly string[]).includes(value); }
function validAgent(value: unknown): value is AgentKind { return typeof value === 'string' && VALID_AGENT_KINDS.has(value as AgentKind); }
function validRecord(value: unknown): value is AgentDecisionRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<AgentDecisionRecord>;
  return record.version === 1 && typeof record.id === 'string' && typeof record.runId === 'string' && typeof record.application === 'string' && typeof record.environment === 'string' && typeof record.timestamp === 'string' && validAgent(record.agent) && typeof record.operation === 'string' && validState(record.state) && Array.isArray(record.evidence) && Array.isArray(record.affectedArtifacts);
}

function positiveInteger(raw: string | undefined, fallback: number): number {
  const value = Number(raw ?? fallback);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function sleepSync(ms: number): void { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

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
    return this.withLedgerLock(() => {
      const timestamp = input.timestamp ?? new Date().toISOString();
      const id = input.id ?? `decision-${randomUUID()}`;
      safeSegment(id, 'decision id');
      const sanitized = redact({ ...input, version: 1 as const, id, timestamp }, { redactPii: true }) as AgentDecisionRecord;
      sanitized.rationale = sanitizeText(sanitized.rationale, { redactPii: true }).slice(0, 4_000);
      if (!validRecord(sanitized)) throw new Error('Invalid agent decision record rejected by ledger contract.');
      fs.mkdirSync(this.decisionsDir, { recursive: true });
      const target = path.join(this.decisionsDir, `${id}.json`);
      const serialized = `${JSON.stringify(sanitized, null, 2)}\n`;
      if (fs.existsSync(target)) {
        const existing = fs.readFileSync(target, 'utf8');
        if (createHash('sha256').update(existing).digest('hex') !== createHash('sha256').update(serialized).digest('hex')) {
          throw new Error(`AGENT_DECISION_CONFLICT: immutable decision '${id}' already exists with different content.`);
        }
        this.ensureJsonlRecord(sanitized);
        return sanitized;
      }
      this.atomicWrite(target, serialized);
      this.appendJsonlRecord(sanitized);
      return sanitized;
    });
  }

  /** Reads schema-valid decisions and fails visibly if a persisted decision is corrupt or schema-invalid. */
  read(): AgentDecisionRecord[] {
    if (!fs.existsSync(this.decisionsDir)) return [];
    const records: AgentDecisionRecord[] = [];
    for (const file of fs.readdirSync(this.decisionsDir).filter((name: string) => name.endsWith('.json')).sort()) {
      const fullPath = path.join(this.decisionsDir, file);
      try {
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as unknown;
        if (!validRecord(parsed)) throw new Error('schema validation failed');
        records.push(parsed);
      } catch (cause) {
        throw new Error(`AGENT_DECISION_LEDGER_CORRUPT: ${fullPath}: ${cause instanceof Error ? cause.message : String(cause)}`);
      }
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

  /** Regenerates the convenient JSONL view on demand; append() uses an O(1) line append instead of rebuilding history. */
  exportJsonl(): string { return this.withLedgerLock(() => this.exportJsonlUnlocked()); }

  private appendJsonlRecord(record: AgentDecisionRecord): void {
    fs.mkdirSync(this.root, { recursive: true });
    const target = path.join(this.root, 'agent-decision-ledger.jsonl');
    fs.appendFileSync(target, `${JSON.stringify(record)}
`, { encoding: 'utf8', mode: 0o600 });
  }

  private ensureJsonlRecord(record: AgentDecisionRecord): void {
    fs.mkdirSync(this.root, { recursive: true });
    const target = path.join(this.root, 'agent-decision-ledger.jsonl');
    if (!fs.existsSync(target)) { this.appendJsonlRecord(record); return; }
    const lines = fs.readFileSync(target, 'utf8').split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      let parsed: unknown;
      try { parsed = JSON.parse(line); } catch { throw new Error(`AGENT_DECISION_LEDGER_CORRUPT: ${target}: invalid JSONL record`); }
      if (validRecord(parsed) && parsed.id === record.id) return;
    }
    this.appendJsonlRecord(record);
  }

  private exportJsonlUnlocked(): string {
    fs.mkdirSync(this.root, { recursive: true });
    const target = path.join(this.root, 'agent-decision-ledger.jsonl');
    const body = this.read().map(record => JSON.stringify(record)).join('\n');
    this.atomicWrite(target, body ? `${body}\n` : '');
    return target;
  }

  private withLedgerLock<T>(operation: () => T): T {
    fs.mkdirSync(this.root, { recursive: true });
    const lock = path.join(this.root, '.agent-decision-ledger.lock');
    const timeoutMs = positiveInteger(process.env.AGENTIC_LEDGER_LOCK_TIMEOUT_MS, 2_000);
    const staleMs = positiveInteger(process.env.AGENTIC_LEDGER_STALE_LOCK_MS, 30_000);
    const started = Date.now();
    let handle: number | undefined;
    while (handle === undefined) {
      try {
        handle = fs.openSync(lock, 'wx', 0o600);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        try {
          if (Date.now() - fs.statSync(lock).mtimeMs > staleMs) { fs.rmSync(lock, { force: true }); continue; }
        } catch { /* lock disappeared while inspecting */ }
        if (Date.now() - started >= timeoutMs) throw new Error(`AGENT_DECISION_LEDGER_LOCK_TIMEOUT: ${lock}`);
        sleepSync(20);
        continue;
      }
      try {
        fs.writeFileSync(handle, `${process.pid}\n${new Date().toISOString()}\n`, 'utf8');
      } catch (error) {
        fs.closeSync(handle);
        handle = undefined;
        fs.rmSync(lock, { force: true });
        throw error;
      }
    }
    try { return operation(); }
    finally {
      fs.closeSync(handle);
      fs.rmSync(lock, { force: true });
    }
  }

  private atomicWrite(file: string, content: string): void {
    const temp = `${file}.${process.pid}.${randomBytes(3).toString('hex')}.tmp`;
    fs.writeFileSync(temp, content, { encoding: 'utf8', mode: 0o600 });
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
}
