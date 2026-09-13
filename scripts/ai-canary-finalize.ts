import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { sanitizeText } from '../src/framework/logging/redactor';
import type { AiProviderCanaryRecord, AiProviderCheckOutcome } from '../src/framework/ai/ai-provider-health.store';
import { ProjectPaths } from '../src/framework/core/config/project.paths';

/**
 * Author: Raushan Raj
 * Business Use: Converts live-provider CI step outcomes into a small auditable canary record.
 * How to use: CI calls this after provider/generation and real healing checks, even when either step failed.
 * Benefit: Provider availability becomes observable without changing deterministic release facts or leaking secrets/log payloads.
 */
function main(): void {
  const target = path.resolve(process.env.AI_CANARY_RECORD_FILE ?? path.join(ProjectPaths.reports(), 'ai-provider-canary.json'));
  const existing = readExisting(target);
  const hasAiTests = process.env.AI_CANARY_HAS_TESTS !== 'false';
  const configurationOutcome = outcome(process.env.AI_CANARY_CONFIG_OUTCOME);
  const providerCheckOutcome = outcome(process.env.AI_CANARY_PROVIDER_OUTCOME);
  const healingOutcome = outcome(process.env.AI_CANARY_HEALING_OUTCOME);
  const configured = configurationOutcome === 'passed';
  const attempted = providerCheckOutcome !== 'skipped' || healingOutcome !== 'skipped';
  const status = !hasAiTests ? 'SKIPPED' : !configured ? 'MISCONFIGURED' : !attempted ? 'SKIPPED' : providerCheckOutcome === 'passed' && healingOutcome === 'passed' ? 'HEALTHY' : 'DEGRADED';
  const runId = process.env.RUN_ID?.trim() || existing?.runId || 'unknown-run';
  const [workflowRunId, attemptRaw] = runId.match(/^(.*)-(\d+)$/)?.slice(1) ?? [process.env.GITHUB_RUN_ID ?? '', process.env.GITHUB_RUN_ATTEMPT ?? ''];

  const record: AiProviderCanaryRecord = {
    runId,
    workflowRunId: workflowRunId || process.env.GITHUB_RUN_ID || undefined,
    attempt: positiveInt(attemptRaw || process.env.GITHUB_RUN_ATTEMPT),
    application: process.env.APP?.trim() || existing?.application || 'unknown-app',
    environment: process.env.ENV?.trim() || existing?.environment || 'unknown-env',
    recordedAt: new Date().toISOString(),
    status,
    providerMode: process.env.AI_PROVIDER_MODE?.trim() || existing?.providerMode || 'single',
    providers: existing?.providers?.length ? existing.providers : configuredProviders(),
    model: existing?.model ?? configuredModel(),
    configurationOutcome,
    providerCheckOutcome,
    healingOutcome,
    healthLatencyMs: existing?.healthLatencyMs,
    generationLatencyMs: existing?.generationLatencyMs,
    healingLatencyMs: positiveInt(process.env.AI_CANARY_HEALING_LATENCY_MS),
    errorKind: sanitizeText(process.env.AI_CANARY_ERROR_KIND ?? existing?.errorKind ?? (healingOutcome === 'failed' ? 'HEALING_CHECK_FAILED' : '')).slice(0, 120) || undefined,
    errorMessage: sanitizeText(process.env.AI_CANARY_ERROR_MESSAGE ?? existing?.errorMessage ?? (healingOutcome === 'failed' ? 'Live AI healing journey failed; inspect the AI test/audit artifact for provider evidence.' : '')).slice(0, 300) || undefined
  };

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(record, null, 2), 'utf8');
  console.log(`[ai:canary] status=${record.status} provider=${record.providers.join(' -> ') || 'unconfigured'} model=${record.model ?? 'n/a'} record=${target}`);

  if (record.status !== 'HEALTHY') {
    console.log(`::warning::Live AI provider canary is ${record.status}. Deterministic AI safety contracts remain the release correctness gate.`);
  }
}

function readExisting(file: string): AiProviderCanaryRecord | undefined {
  if (!fs.existsSync(file)) return undefined;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as AiProviderCanaryRecord; }
  catch { return undefined; }
}

function outcome(value?: string): AiProviderCheckOutcome {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'passed' || normalized === 'success' || normalized === 'succeeded') return 'passed';
  if (normalized === 'failed' || normalized === 'failure' || normalized === 'cancelled' || normalized === 'canceled') return 'failed';
  return 'skipped';
}

function configuredProviders(): string[] {
  if ((process.env.AI_PROVIDER_MODE ?? 'single') === 'failover') return (process.env.AI_PROVIDER_ORDER ?? '').split(',').map((v: string) => v.trim()).filter(Boolean);
  const provider = process.env.AI_PROVIDER?.trim();
  return provider ? [provider] : [];
}
function configuredModel(): string | undefined {
  const provider = configuredProviders()[0];
  if (provider === 'gemini') return process.env.GEMINI_MODEL?.trim() || undefined;
  if (provider === 'openai') return process.env.OPENAI_MODEL?.trim() || undefined;
  if (provider === 'anthropic') return process.env.ANTHROPIC_MODEL?.trim() || undefined;
  if (provider === 'azure-openai') return process.env.AZURE_OPENAI_MODEL?.trim() || undefined;
  return process.env.AI_COMPAT_MODEL?.trim() || process.env.AI_MODEL?.trim() || undefined;
}
function positiveInt(value?: string): number | undefined { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : undefined; }
main();
