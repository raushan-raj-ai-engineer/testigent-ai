import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createAiProvider, resolveProviderOrder } from '../src/framework/ai/ai-provider.factory';
import { AiProviderError } from '../src/framework/ai/ai-provider.error';
import type { AiProviderCanaryRecord } from '../src/framework/ai/ai-provider-health.store';
import { sanitizeText } from '../src/framework/logging/redactor';

/**
 * Author: Raushan Raj
 * Business Use: Validates configured AI provider health independently of browser execution.
 *
 * AI_PROVIDER_GENERATION_CHECK=true additionally performs one tiny real generation
 * request through the same governed locator contract. This catches cases where
 * key/model metadata validation passes but the generation endpoint is unavailable.
 */
export async function main(): Promise<void> {
  let providers: string[] = [];
  let model: string | undefined;
  let healthLatencyMs: number | undefined;
  let generationLatencyMs: number | undefined;
  if (process.env.AI_ENABLED !== 'true') {
    throw new Error('AI_ENABLED must be true for provider validation.');
  }

  const names = resolveProviderOrder();
  providers = names;
  model = configuredModel(names[0]);
  if (names.length === 0) {
    throw new Error(
      'No AI provider resolved. For single mode set AI_PROVIDER=<provider>. ' +
      'For failover mode set AI_PROVIDER_ORDER=<provider1,provider2,...> and required provider configuration.'
    );
  }

  console.log(`[config] mode=${process.env.AI_PROVIDER_MODE ?? 'single'} providers=${names.join(' -> ')}`);

  const provider = createAiProvider();
  if (!provider) throw new Error('AI provider was not created.');

  if (provider.healthCheck) {
    const healthStarted = Date.now();
    const health = await provider.healthCheck();
    healthLatencyMs = Date.now() - healthStarted;
    console.log(`[health] ${health.message}`);
    if (!health.ok) throw new Error(health.message);
  } else {
    console.log(`[health] Provider chain '${names.join(' -> ')}' is configured but has no health-check implementation.`);
  }

  if ((process.env.AI_PROVIDER_GENERATION_CHECK ?? 'false').toLowerCase() !== 'true') return;

  const started = Date.now();
  const result = await provider.proposeLocator({
    planId: 'provider-generation-smoke',
    businessName: 'Search input',
    accessibilitySnapshot: '- textbox "Search"',
    allowedDescriptorTypes: ['role', 'label', 'testId', 'placeholder', 'text']
  });

  if (!result) {
    throw new Error('AI provider generation check returned no governed locator response.');
  }

  generationLatencyMs = result.latencyMs ?? Date.now() - started;
  model = result.model ?? model;
  console.log(
    `[generation] status=success provider=${result.provider ?? names[0]} ` +
    `model=${result.model ?? 'n/a'} latencyMs=${generationLatencyMs}`
  );
  writeHealthRecord({ status: 'HEALTHY', providers, model, healthLatencyMs, generationLatencyMs });
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  const providerError = error instanceof AiProviderError ? error : undefined;
  writeHealthRecord({
    status: 'DEGRADED',
    providers: safeProviderNames(),
    model: configuredModel(safeProviderNames()[0]),
    errorKind: providerError ? [providerError.kind, providerError.statusCode ? `HTTP_${providerError.statusCode}` : undefined, providerError.providerCode].filter(Boolean).join(':') : error instanceof Error ? error.name : 'ProviderError',
    errorMessage: message
  });
  console.error(`[ai:check] ${message}`);
  process.exitCode = 1;
});

function writeHealthRecord(input: Partial<AiProviderCanaryRecord> & Pick<AiProviderCanaryRecord, 'status' | 'providers'>): void {
  const target = process.env.AI_PROVIDER_HEALTH_FILE?.trim();
  if (!target) return;
  const runId = process.env.RUN_ID?.trim() || 'unknown-run';
  const match = runId.match(/^(.*)-(\d+)$/);
  const record: AiProviderCanaryRecord = {
    runId,
    workflowRunId: match?.[1] || process.env.GITHUB_RUN_ID || undefined,
    attempt: Number(match?.[2] || process.env.GITHUB_RUN_ATTEMPT || 0) || undefined,
    application: process.env.APP?.trim() || 'unknown-app',
    environment: process.env.ENV?.trim() || 'unknown-env',
    recordedAt: new Date().toISOString(),
    status: input.status,
    providerMode: process.env.AI_PROVIDER_MODE?.trim() || 'single',
    providers: input.providers,
    model: input.model,
    configurationOutcome: 'passed',
    providerCheckOutcome: input.status === 'HEALTHY' ? 'passed' : 'failed',
    healingOutcome: 'skipped',
    healthLatencyMs: input.healthLatencyMs,
    generationLatencyMs: input.generationLatencyMs,
    errorKind: input.errorKind?.slice(0, 120),
    errorMessage: input.errorMessage ? sanitizeText(input.errorMessage).replace(/[\r\n\t]+/g, ' ').slice(0, 300) : undefined
  };
  fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
  fs.writeFileSync(path.resolve(target), JSON.stringify(record, null, 2), 'utf8');
}
function safeProviderNames(): string[] {
  try { return resolveProviderOrder(); } catch { return process.env.AI_PROVIDER?.trim() ? [process.env.AI_PROVIDER.trim()] : []; }
}
function configuredModel(provider?: string): string | undefined {
  if (provider === 'gemini') return process.env.GEMINI_MODEL?.trim() || undefined;
  if (provider === 'openai') return process.env.OPENAI_MODEL?.trim() || undefined;
  if (provider === 'anthropic') return process.env.ANTHROPIC_MODEL?.trim() || undefined;
  if (provider === 'azure-openai') return process.env.AZURE_OPENAI_MODEL?.trim() || undefined;
  return process.env.AI_COMPAT_MODEL?.trim() || process.env.AI_MODEL?.trim() || undefined;
}
