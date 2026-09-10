import { test, expect } from '../../fixtures/test.fixture';
import { HealingOrchestrator } from '../../../../src/framework/healing/healing.orchestrator';
import type { LocatorPlan } from '../../../../src/framework/healing/healing.types';
import { ApplicationRegistry } from '../../../../src/framework/core/config/application.registry';
import { createAiGateway } from '../../../../src/framework/ai/ai-provider.factory';

const aiOnlyTodoInput: LocatorPlan = {
  id: 'demo.ai-healing.todo.new',
  businessName: 'New work item input',
  primary: { type: 'testId', value: 'intentionally-missing-ai-demo-locator' }
};

/**
 * Author: Raushan Raj
 * Business Use: Demonstrates genuine AI locator recovery when primary, cache and configured fallback recovery are unavailable.
 * How to use: Configure any supported AI provider, set AI_ENABLED=true + HEALING_AI_ENABLED=true, then run npm run test:ai-healing.
 * Benefit: Proves the guarded provider-neutral AI path end-to-end while preserving deterministic business assertions and auditable confidence evidence.
 */
test.describe('AI self-healing demonstration', () => {
  test.skip(process.env.AI_HEALING_DEMO !== 'true', 'Run through npm run test:ai-healing only.');

  test('configured AI provider proposes and validates a replacement locator @ai @healing @ui', async ({ page, logger }, testInfo) => {
    const gateway = createAiGateway(testInfo.testId);
    if (!gateway) {
      throw new Error(
        'AI healing demo was requested but no provider resolved. Configure AI_PROVIDER_MODE and AI_PROVIDER/AI_PROVIDER_ORDER with required provider settings.'
      );
    }
    const healer = new HealingOrchestrator(page, logger.child({ layer: 'UI_AI_HEALING_DEMO' }), gateway, testInfo.testId);
    const workItem = `AI healing ${process.env.AI_PROVIDER ?? 'configured-provider'} ${Date.now()}`;

    await test.step('Open the work management application', async () => {
      await page.goto(ApplicationRegistry.get('demo').uiBaseUrl);
    });

    await test.step('Use the configured guarded AI provider to recover the changed work item locator', async () => {
      await healer.fillAndPress(aiOnlyTodoInput, workItem, 'Enter');
    });

    await test.step('Verify the business action completed successfully', async () => {
      await expect(page.getByText(workItem, { exact: true })).toBeVisible();
    });
  });
});
