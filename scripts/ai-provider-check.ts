import 'dotenv/config';
import { createAiProvider, resolveProviderOrder } from '../src/framework/ai/ai-provider.factory';

/**
 * Author: Raushan Raj
 * Business Use: Validates the explicitly selected AI provider configuration independently of Playwright/browser execution.
 * How to use: Configure AI_ENABLED, AI_PROVIDER_MODE and provider settings, then run npm run ai:check.
 * Benefit: Separates provider/network/key problems from test automation failures without printing secrets.
 */
async function main(): Promise<void> {
  if (process.env.AI_ENABLED !== 'true') {
    throw new Error('AI_ENABLED must be true for provider validation.');
  }

  const names = resolveProviderOrder();
  if (names.length === 0) {
    throw new Error(
      'No AI provider resolved. For single mode set AI_PROVIDER=<provider>. ' +
      'For failover mode set AI_PROVIDER_ORDER=<provider1,provider2,...> and required provider configuration.'
    );
  }

  console.log(`[config] mode=${process.env.AI_PROVIDER_MODE ?? 'single'} providers=${names.join(' -> ')}`);

  const provider = createAiProvider();
  if (!provider) throw new Error('AI provider was not created.');
  if (!provider.healthCheck) {
    console.log(`[health] Provider chain '${names.join(' -> ')}' is configured but has no health-check implementation.`);
    return;
  }
  const health = await provider.healthCheck();
  console.log(`[health] ${health.message}`);
  if (!health.ok) process.exit(1);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
