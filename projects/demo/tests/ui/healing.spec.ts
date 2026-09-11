import { test, expect } from '../../fixtures/test.fixture';
import { HealingOrchestrator } from '../../../../src/framework/healing/healing.orchestrator';
import type { LocatorPlan } from '../../../../src/framework/healing/healing.types';

const intentionallyChangedTodoInput: LocatorPlan = {
  id: 'demo.healing.todo.new',
  businessName: 'New work item input',
  primary: { type: 'testId', value: 'intentionally-missing-locator' },
  fallbacks: [{ type: 'placeholder', value: 'What needs to be done?' }]
};

/**
 * Author: Raushan Raj
 * Business Use: Demonstrates guarded self-healing without modifying the real application or weakening assertions.
 * How to use: Run `npm run test:healing`. The primary locator is intentionally invalid and a deterministic fallback is recovered.
 * Benefit: Teams can validate healing audit/reporting safely before enabling healing against enterprise applications.
 */
test.describe('Self-healing demonstration', () => {
  test.skip(process.env.HEALING_DEMO !== 'true', 'Run through npm run test:healing only.');

  test('framework recovers an intentionally changed locator @healing @ui', async ({ page, logger, runtime }) => {
    const healer = new HealingOrchestrator(page, logger.child({ layer: 'UI_HEALING_DEMO' }));
    const workItem = `Healing demo ${Date.now()}`;

    await test.step('Open the work management application', async () => {
      await page.goto(runtime.application.uiBaseUrl);
    });

    await test.step('Recover the changed work item locator and create an item', async () => {
      await healer.fillAndPress(intentionallyChangedTodoInput, workItem, 'Enter', {
        postCondition: {
          description: 'New work item becomes visible after pressing Enter',
          verify: () => page.getByText(workItem, { exact: true }).isVisible()
        }
      });
    });

    await test.step('Verify the business action still completed successfully', async () => {
      await expect(page.getByText(workItem, { exact: true })).toBeVisible();
    });
  });
});
