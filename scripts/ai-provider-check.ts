import 'dotenv/config';
import { createAiProvider, resolveProviderOrder } from '../src/framework/ai/ai-provider.factory';

/**
 * Author: Raushan Raj
 * Business Use: Validates configured AI provider health independently of browser execution.
 *
 * AI_PROVIDER_GENERATION_CHECK=true additionally performs one tiny real generation
 * request through the same governed locator contract. This catches cases where
 * key/model metadata validation passes but the generation endpoint is unavailable.
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

  if (provider.healthCheck) {
    const health = await provider.healthCheck();
    console.log(`[health] ${health.message}`);
    if (!health.ok) process.exit(1);
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

  console.log(
    `[generation] status=success provider=${result.provider ?? names[0]} ` +
    `model=${result.model ?? 'n/a'} latencyMs=${result.latencyMs ?? Date.now() - started}`
  );
}

main().catch(error => {
  console.error(`[ai:check] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
