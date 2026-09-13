import { expect, test } from '@playwright/test';
import { rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { HealingOrchestrator } from '../../src/framework/healing/healing.orchestrator.js';
import type { AiGateway } from '../../src/framework/ai/ai.gateway.js';
import type { LocatorPlan } from '../../src/framework/healing/healing.types.js';

/**
 * Author: Raushan Raj
 * Business Use: Seed genuine business failures and prove recovery cannot silently convert them into a clean pass.
 * How to use: Run `npm run test:healing:safety` or the architect-review hardening gate.
 * Benefit: False-heal prevention is measured separately from successful locator recovery.
 */
test.describe('False-heal safety benchmark', () => {
  test('an actionable primary locator cannot override a failed business post-condition', async ({ page }) => {
    await page.setContent('<button id="submit">Submit</button><div id="success" hidden>Saved</div>');
    const healer = new HealingOrchestrator(page, { warn: () => undefined });
    const plan: LocatorPlan = {
      id: 'safety.primary-business-failure',
      businessName: 'Submit order',
      primary: { type: 'role', role: 'button', name: 'Submit', exact: true }
    };

    await expect(healer.click(plan, {
      postCondition: {
        description: 'Order success confirmation becomes visible',
        timeoutMs: 120,
        intervalMs: 20,
        verify: () => page.locator('#success').isVisible()
      }
    })).rejects.toThrow(/Post-condition failed/);

    await expect(page.locator('#success')).toBeHidden();
  });

  test('a wrong AI recovery is rejected and never promoted into reusable cache', async ({ page }) => {
    const app = `false-heal-safety-${Date.now()}`;
    const previous = { app: process.env.APP, env: process.env.ENV, mode: process.env.HEALING_MODE, ai: process.env.HEALING_AI_ENABLED };
    process.env.APP = app;
    process.env.ENV = 'qa';
    process.env.HEALING_MODE = 'runtime';
    process.env.HEALING_AI_ENABLED = 'true';

    const fakeAi: Pick<AiGateway, 'proposeLocator'> = {
      proposeLocator: async () => ({
        descriptor: { type: 'role', role: 'button', name: 'Wrong action', exact: true },
        confidence: 0.99,
        reason: 'Seeded wrong recovery for false-heal benchmark',
        provider: 'synthetic-safety-provider',
        model: 'synthetic-safety-model',
        latencyMs: 1
      })
    };
    const plan: LocatorPlan = {
      id: 'safety.ai-business-failure',
      businessName: 'Open protected business state',
      primary: { type: 'role', role: 'button', name: 'Missing primary', exact: true }
    };

    try {
      await page.setContent('<button>Wrong action</button><div id="business-state" hidden>Expected state</div>');
      const healer = new HealingOrchestrator(page, { warn: () => undefined }, fakeAi);
      await expect(healer.click(plan, {
        postCondition: {
          description: 'Expected business state becomes visible',
          timeoutMs: 120,
          intervalMs: 20,
          verify: () => page.locator('#business-state').isVisible()
        }
      })).rejects.toThrow(/Post-condition failed/);

      const cachePath = resolve('.healing', app, 'qa', 'locator-cache.json');
      if (existsSync(cachePath)) {
        const parsed = JSON.parse(await readFile(cachePath, 'utf8')) as { records?: Record<string, unknown> };
        expect(parsed.records?.[plan.id]).toBeUndefined();
      }
      await expect(page.locator('#business-state')).toBeHidden();
    } finally {
      await rm(resolve('.healing', app), { recursive: true, force: true });
      await rm(resolve('reports', app), { recursive: true, force: true });
      previous.app === undefined ? delete process.env.APP : process.env.APP = previous.app;
      previous.env === undefined ? delete process.env.ENV : process.env.ENV = previous.env;
      previous.mode === undefined ? delete process.env.HEALING_MODE : process.env.HEALING_MODE = previous.mode;
      previous.ai === undefined ? delete process.env.HEALING_AI_ENABLED : process.env.HEALING_AI_ENABLED = previous.ai;
    }
  });
});
