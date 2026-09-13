import fs from 'node:fs';
import path from 'node:path';
import { AiProviderHealthStore, isAiProviderCanaryRecord, type AiProviderCanaryRecord } from '../src/framework/ai/ai-provider-health.store';

/**
 * Author: Raushan Raj
 * Business Use: Resolves the newest trustworthy live-provider canary from the current workflow-run family and appends it to environment-scoped history.
 * How to use: `tsx scripts/ci-provider-health.ts <download-dir>` after restoring .report-history.
 * Benefit: Provider-health and AI-lane inclusion use immutable canary evidence rather than mutable job state, including failed-only reruns.
 */
function main(): void {
  const root = path.resolve(process.argv[2] ?? 'ai-canary-records');
  const workflowRunId = process.env.CI_WORKFLOW_RUN_ID?.trim() || process.env.GITHUB_RUN_ID?.trim();
  const maxAttempt = positiveInt(process.env.CI_WORKFLOW_RUN_ATTEMPT ?? process.env.GITHUB_RUN_ATTEMPT) ?? Number.MAX_SAFE_INTEGER;
  const expected = truthy(process.env.AI_CANARY_EXPECTED);
  const records = fs.existsSync(root) ? findJson(root).flatMap(file => {
    try { return [JSON.parse(fs.readFileSync(file, 'utf8')) as AiProviderCanaryRecord]; }
    catch { return []; }
  }) : [];
  const selected = selectProviderCanary(records, workflowRunId, maxAttempt, expected, process.env.APP?.trim(), process.env.ENV?.trim());

  if (!selected) {
    const skipped = skippedRecord(workflowRunId, maxAttempt);
    new AiProviderHealthStore().append(skipped);
    publishOutputs(skipped);
    console.log(`[ai:health] no live canary expected; recorded SKIPPED for ${skipped.runId}`);
    return;
  }

  new AiProviderHealthStore().append(selected);
  publishOutputs(selected);
  console.log(`[ai:health] recorded ${selected.status} from ${selected.runId}`);
}

export function selectProviderCanary(records: unknown[], workflowRunId: string | undefined, maxAttempt: number, expected: boolean, application?: string, environment?: string): AiProviderCanaryRecord | undefined {
  if (expected && (!workflowRunId?.trim() || !application?.trim() || !environment?.trim())) {
    throw new Error('AI_PROVIDER_CANARY_IDENTITY_MISSING: expected canary resolution requires workflow run, application and environment identity.');
  }
  const candidates = records
    .filter(isAiProviderCanaryRecord)
    .filter(record => belongsToWorkflow(record, workflowRunId) && (!record.attempt || record.attempt <= maxAttempt))
    .filter(record => (!application || record.application === application) && (!environment || record.environment === environment))
    .sort((a, b) => (b.attempt ?? 0) - (a.attempt ?? 0) || Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
  if (!candidates.length) {
    if (expected) throw new Error(`AI_PROVIDER_CANARY_MISSING: expected a canary artifact for workflow run ${workflowRunId ?? '<unknown>'}.`);
    return undefined;
  }
  return candidates[0];
}

function belongsToWorkflow(record: AiProviderCanaryRecord, workflowRunId?: string): boolean {
  if (!workflowRunId) return true;
  return record.workflowRunId === workflowRunId || record.runId === workflowRunId || record.runId.startsWith(`${workflowRunId}-`);
}
function skippedRecord(workflowRunId: string | undefined, attempt: number): AiProviderCanaryRecord {
  const app = process.env.APP?.trim() || 'unknown-app';
  const environment = process.env.ENV?.trim() || 'unknown-env';
  const realAttempt = Number.isSafeInteger(attempt) && attempt < Number.MAX_SAFE_INTEGER ? attempt : 1;
  const runId = workflowRunId ? (process.env.GITHUB_RUN_ID ? `${workflowRunId}-${realAttempt}` : workflowRunId) : process.env.RUN_ID?.trim() || 'unknown-run';
  return { runId, workflowRunId, attempt: realAttempt, application: app, environment, recordedAt: new Date().toISOString(), status: 'SKIPPED', providerMode: process.env.AI_PROVIDER_MODE?.trim() || 'single', providers: [], configurationOutcome: 'skipped', providerCheckOutcome: 'skipped', healingOutcome: 'skipped' };
}
function publishOutputs(record: AiProviderCanaryRecord): void {
  const healthy = record.status === 'HEALTHY';
  const output = process.env.GITHUB_OUTPUT?.trim();
  if (output) fs.appendFileSync(output, `canary_status=${record.status}\ncanary_healthy=${healthy}\ncanary_run_id=${record.runId}\n`, 'utf8');
  if (process.env.TF_BUILD === 'True' || process.env.AGENT_ID) {
    console.log(`##vso[task.setvariable variable=CANARY_STATUS]${record.status}`);
    console.log(`##vso[task.setvariable variable=CANARY_HEALTHY]${healthy}`);
  }
}
function findJson(root: string): string[] {
  const output: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...findJson(target));
    else if (entry.isFile() && entry.name === 'ai-provider-canary.json') output.push(target);
  }
  return output;
}
function truthy(value?: string): boolean { return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase()); }
function positiveInt(value?: string): number | undefined { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : undefined; }
if (require.main === module) main();
