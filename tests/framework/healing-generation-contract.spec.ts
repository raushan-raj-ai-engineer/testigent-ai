import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HealingOrchestrator } from '../../src/framework/healing/healing.orchestrator.js';
import type { LocatorPlan } from '../../src/framework/healing/healing.types.js';

/** Author: Raushan Raj */
test.describe('Healing-aware generation contract', () => {
  test('generator template is healing-aware and proposal review blocks bypass', async () => {
    const generator = await readFile(join(process.cwd(), 'src/framework/intelligence/generation/framework.generator.ts'), 'utf8');
    const review = await readFile(join(process.cwd(), 'src/framework/intelligence/review/proposal.review.ts'), 'utf8');
    expect(generator).toContain('LocatorPlan');
    expect(generator).toContain('this.healingClick(this.primaryActionPlan)');
    expect(review).toContain('direct Playwright UI action bypasses the HealingOrchestrator contract');
  });

  test('scoped locator plan stays inside its modal and uses deterministic fallback', async ({ page }) => {
    await page.setContent(`<button>Save</button><div id="user-modal"><button id="modal-save">Create</button></div>`);
    const logger = { warn: () => undefined } as any;
    const healer = new HealingOrchestrator(page, logger);
    const plan: LocatorPlan = {
      id: 'contract.modal.create',
      businessName: 'Create user submit',
      scope: { id: 'contract.user-modal', businessName: 'User modal', primary: { type: 'css', value: '#user-modal' } },
      primary: { type: 'role', role: 'button', name: 'Missing' },
      fallbacks: [{ type: 'role', role: 'button', name: 'Create', exact: true }]
    };
    process.env.HEALING_MODE = 'runtime';
    const locator = await healer.resolve(plan);
    await expect(locator).toHaveAttribute('id', 'modal-save');
  });

  test('healing priority uses deterministic fallback before a previously cached locator', async ({ page }) => {
    const app = `healing-order-${Date.now()}-fallback`;
    const previousApp = process.env.APP;
    const previousMode = process.env.HEALING_MODE;
    process.env.APP = app;
    process.env.HEALING_MODE = 'runtime';

    const { mkdir, writeFile, rm } = await import('node:fs/promises');
    const { dirname, resolve } = await import('node:path');
    const cachePath = resolve('.healing', app, 'locator-cache.json');
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, JSON.stringify({
      'contract.priority': {
        descriptor: { type: 'role', role: 'button', name: 'Cached', exact: true },
        confidence: 0.99,
        updatedAt: new Date().toISOString()
      }
    }), 'utf8');

    try {
      await page.setContent('<button id="fallback">Fallback</button><button id="cached">Cached</button>');
      const healer = new HealingOrchestrator(page, { warn: () => undefined } as any);
      const plan: LocatorPlan = {
        id: 'contract.priority',
        businessName: 'Priority action',
        primary: { type: 'role', role: 'button', name: 'Missing', exact: true },
        fallbacks: [{ type: 'role', role: 'button', name: 'Fallback', exact: true }]
      };

      const locator = await healer.resolve(plan);
      await expect(locator).toHaveAttribute('id', 'fallback');
    } finally {
      await rm(resolve('.healing', app), { recursive: true, force: true });
      if (previousApp === undefined) delete process.env.APP; else process.env.APP = previousApp;
      if (previousMode === undefined) delete process.env.HEALING_MODE; else process.env.HEALING_MODE = previousMode;
    }
  });

  test('validated cache is used only after declared deterministic fallbacks fail', async ({ page }) => {
    const app = `healing-order-${Date.now()}-cache`;
    const previousApp = process.env.APP;
    const previousMode = process.env.HEALING_MODE;
    process.env.APP = app;
    process.env.HEALING_MODE = 'runtime';

    const { mkdir, writeFile, rm } = await import('node:fs/promises');
    const { dirname, resolve } = await import('node:path');
    const cachePath = resolve('.healing', app, 'locator-cache.json');
    await mkdir(dirname(cachePath), { recursive: true });
    await writeFile(cachePath, JSON.stringify({
      'contract.cache-after-fallback': {
        descriptor: { type: 'role', role: 'button', name: 'Cached', exact: true },
        confidence: 0.99,
        updatedAt: new Date().toISOString()
      }
    }), 'utf8');

    try {
      await page.setContent('<button id="cached">Cached</button>');
      const healer = new HealingOrchestrator(page, { warn: () => undefined } as any);
      const plan: LocatorPlan = {
        id: 'contract.cache-after-fallback',
        businessName: 'Cached action',
        primary: { type: 'role', role: 'button', name: 'Missing', exact: true },
        fallbacks: [{ type: 'role', role: 'button', name: 'Also Missing', exact: true }]
      };

      const locator = await healer.resolve(plan);
      await expect(locator).toHaveAttribute('id', 'cached');
    } finally {
      await rm(resolve('.healing', app), { recursive: true, force: true });
      if (previousApp === undefined) delete process.env.APP; else process.env.APP = previousApp;
      if (previousMode === undefined) delete process.env.HEALING_MODE; else process.env.HEALING_MODE = previousMode;
    }
  });
});
