import fs from 'node:fs';
import path from 'node:path';
import { resolveApplicationScope } from '../core/config/application.scope';
import { RunContext } from '../core/config/run.context';
import { redact } from '../logging/redactor';

export type AiAuditPurpose = 'healing' | 'reporting';
export type AiAuditStatus = 'success' | 'no-result' | 'error' | 'budget-blocked';

export interface AiAuditRecord {
  runId: string;
  testId?: string;
  timestamp: string;
  purpose: AiAuditPurpose;
  status: AiAuditStatus;
  provider?: string;
  model?: string;
  latencyMs?: number;
  message?: string;
}

/**
 * Security-safe AI runtime audit. Prompts, snapshots, keys and raw model output are never persisted here.
 * It records only operational metadata needed to prove which provider/model was actually used.
 */
export class AiAudit {
  constructor(
    private readonly testId?: string,
    private readonly filePath = path.resolve('reports', resolveApplicationScope(), 'ai', 'ai-audit.jsonl')
  ) {}

  record(input: Omit<AiAuditRecord, 'runId' | 'testId' | 'timestamp'>): void {
    if ((process.env.AI_AUDIT_ENABLED ?? 'true').toLowerCase() !== 'true' && (process.env.AI_RUNTIME_LOGGING ?? 'true').toLowerCase() !== 'true') return;
    const record = redact({
      runId: RunContext.get().runId,
      testId: this.testId,
      timestamp: new Date().toISOString(),
      ...input
    }) as AiAuditRecord;

    if ((process.env.AI_AUDIT_ENABLED ?? 'true').toLowerCase() === 'true') {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.appendFileSync(this.filePath, `${JSON.stringify(record)}\n`);
    }

    if ((process.env.AI_RUNTIME_LOGGING ?? 'true').toLowerCase() === 'true') {
      const provider = record.provider ?? 'none';
      const model = record.model ?? 'n/a';
      const latency = record.latencyMs === undefined ? '' : ` latencyMs=${record.latencyMs}`;
      console.log(`[ai:${record.purpose}] status=${record.status} provider=${provider} model=${model}${latency}`);
    }
  }
}
