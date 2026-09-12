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
    expect(generator).toContain('this.healingClick(this.primaryActionPlan, {');
    expect(generator).toContain('postCondition');
    expect(generator).toContain('semantic post-condition');
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
        updatedAt: new Date().toISOString(),
        validation: 'semantic',
        verificationDescription: 'Synthetic previously validated recovery'
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
        updatedAt: new Date().toISOString(),
        validation: 'semantic',
        verificationDescription: 'Synthetic previously validated recovery'
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


test.describe('Visibility-aware locator cardinality', () => {
  test('visibility-aware resolution ignores hidden duplicates for a unique locator', async ({ page }) => {
    await page.setContent(`
      <button style="display:none">Create User</button>
      <button id="visible-create">Create User</button>
    `);
    const healer = new HealingOrchestrator(page, { warn: () => undefined } as any);
    const plan: LocatorPlan = {
      id: 'contract.visible-unique',
      businessName: 'Visible Create User',
      primary: { type: 'role', role: 'button', name: 'Create User', exact: true }
    };
    const previousMode = process.env.HEALING_MODE;
    process.env.HEALING_MODE = 'off';
    try {
      const locator = await healer.resolve(plan);
      await expect(locator).toHaveAttribute('id', 'visible-create');
    } finally {
      if (previousMode === undefined) delete process.env.HEALING_MODE; else process.env.HEALING_MODE = previousMode;
    }
  });

  test('firstVisible policy is explicit and can resolve equivalent duplicate visible controls', async ({ page }) => {
    await page.setContent(`
      <button id="create-primary" onclick="document.querySelector('#modal').style.display='block'">Create User</button>
      <button id="create-secondary" onclick="document.querySelector('#modal').style.display='block'">Create User</button>
      <div id="modal" style="display:none">Create form</div>
    `);
    const healer = new HealingOrchestrator(page, { warn: () => undefined } as any);
    const plan: LocatorPlan = {
      id: 'contract.first-visible',
      businessName: 'Open create form',
      primary: { type: 'role', role: 'button', name: 'Create User', exact: true, match: 'firstVisible' }
    };
    const previousMode = process.env.HEALING_MODE;
    process.env.HEALING_MODE = 'off';
    try {
      await healer.click(plan, {
        postCondition: {
          description: 'Create form becomes visible',
          timeoutMs: 200,
          intervalMs: 25,
          verify: () => page.locator('#modal').isVisible()
        }
      });
      await expect(page.locator('#modal')).toBeVisible();
    } finally {
      if (previousMode === undefined) delete process.env.HEALING_MODE; else process.env.HEALING_MODE = previousMode;
    }
  });

  test('duplicate visible controls still fail closed without explicit firstVisible policy', async ({ page }) => {
    await page.setContent('<button>Create User</button><button>Create User</button>');
    const healer = new HealingOrchestrator(page, { warn: () => undefined } as any);
    const plan: LocatorPlan = {
      id: 'contract.ambiguous-visible',
      businessName: 'Ambiguous Create User',
      primary: { type: 'role', role: 'button', name: 'Create User', exact: true }
    };
    const previousMode = process.env.HEALING_MODE;
    process.env.HEALING_MODE = 'off';
    try {
      await expect(healer.resolve(plan)).rejects.toThrow(/Primary locator failed/);
    } finally {
      if (previousMode === undefined) delete process.env.HEALING_MODE; else process.env.HEALING_MODE = previousMode;
    }
  });
});

test.describe('Semantic healing validation', () => {
  test('safe retry rejects a wrong deterministic candidate until the business post-condition passes', async ({ page }) => {
    await page.setContent(`
      <button id="wrong">Wrong action</button>
      <button id="right" onclick="document.querySelector('#modal').classList.remove('hidden')">Open form</button>
      <div id="modal" class="hidden">Form</div>
      <style>.hidden { display:none }</style>
    `);
    const healer = new HealingOrchestrator(page, { warn: () => undefined } as any);
    const plan: LocatorPlan = {
      id: 'contract.semantic-fallback',
      businessName: 'Open form',
      primary: { type: 'role', role: 'button', name: 'Missing', exact: true },
      fallbacks: [
        { type: 'role', role: 'button', name: 'Wrong action', exact: true },
        { type: 'role', role: 'button', name: 'Open form', exact: true }
      ]
    };
    const previousMode = process.env.HEALING_MODE;
    process.env.HEALING_MODE = 'runtime';
    try {
      await healer.click(plan, {
        retryOnPostConditionFailure: true,
        postCondition: {
          description: 'Form becomes visible',
          timeoutMs: 150,
          intervalMs: 25,
          verify: () => page.locator('#modal').isVisible()
        }
      });
      await expect(page.locator('#modal')).toBeVisible();
    } finally {
      if (previousMode === undefined) delete process.env.HEALING_MODE; else process.env.HEALING_MODE = previousMode;
    }
  });

  test('AI recovery enters cache only after semantic validation and next run reuses cache without AI', async ({ page }) => {
    const app = `semantic-cache-${Date.now()}`;
    const previous = {
      app: process.env.APP,
      mode: process.env.HEALING_MODE,
      ai: process.env.HEALING_AI_ENABLED
    };
    process.env.APP = app;
    process.env.HEALING_MODE = 'runtime';
    process.env.HEALING_AI_ENABLED = 'true';

    const { readFile, rm } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    let aiCalls = 0;
    const fakeAi = {
      proposeLocator: async () => {
        aiCalls += 1;
        return {
          descriptor: { type: 'role', role: 'button', name: 'Recovered', exact: true },
          confidence: 0.99,
          reason: 'Synthetic contract recovery',
          provider: 'fake',
          model: 'fake-model',
          latencyMs: 1
        };
      }
    } as any;
    const logger = { warn: () => undefined } as any;
    const plan: LocatorPlan = {
      id: 'contract.semantic-ai-cache',
      businessName: 'Open recovered form',
      primary: { type: 'role', role: 'button', name: 'Missing', exact: true }
    };
    const postCondition = {
      description: 'Recovered form becomes visible',
      timeoutMs: 200,
      intervalMs: 25,
      verify: () => page.locator('#modal').isVisible()
    };

    try {
      await page.setContent(`
        <button onclick="document.querySelector('#modal').classList.remove('hidden')">Recovered</button>
        <div id="modal" class="hidden">Form</div>
        <style>.hidden { display:none }</style>
      `);
      const first = new HealingOrchestrator(page, logger, fakeAi);
      await first.click(plan, { postCondition });
      expect(aiCalls).toBe(1);

      const cache = JSON.parse(await readFile(resolve('.healing', app, 'locator-cache.json'), 'utf8'));
      expect(cache[plan.id].validation).toBe('semantic');
      expect(cache[plan.id].verificationDescription).toBe(postCondition.description);

      await page.locator('#modal').evaluate(element => element.classList.add('hidden'));
      process.env.HEALING_AI_ENABLED = 'false';
      const second = new HealingOrchestrator(page, logger);
      await second.click(plan, { postCondition });
      expect(aiCalls).toBe(1);
      await expect(page.locator('#modal')).toBeVisible();
    } finally {
      await rm(resolve('.healing', app), { recursive: true, force: true });
      await rm(resolve('reports', app), { recursive: true, force: true });
      if (previous.app === undefined) delete process.env.APP; else process.env.APP = previous.app;
      if (previous.mode === undefined) delete process.env.HEALING_MODE; else process.env.HEALING_MODE = previous.mode;
      if (previous.ai === undefined) delete process.env.HEALING_AI_ENABLED; else process.env.HEALING_AI_ENABLED = previous.ai;
    }
  });

  test('rejected AI recovery is never written to reusable cache', async ({ page }) => {
    const app = `semantic-reject-${Date.now()}`;
    const previous = {
      app: process.env.APP,
      mode: process.env.HEALING_MODE,
      ai: process.env.HEALING_AI_ENABLED
    };
    process.env.APP = app;
    process.env.HEALING_MODE = 'runtime';
    process.env.HEALING_AI_ENABLED = 'true';

    const { readFile, rm } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const fakeAi = {
      proposeLocator: async () => ({
        descriptor: { type: 'role', role: 'button', name: 'Wrong action', exact: true },
        confidence: 0.99,
        reason: 'Deliberately wrong contract candidate',
        provider: 'fake',
        model: 'fake-model',
        latencyMs: 1
      })
    } as any;
    const plan: LocatorPlan = {
      id: 'contract.semantic-ai-reject',
      businessName: 'Open intended form',
      primary: { type: 'role', role: 'button', name: 'Missing', exact: true }
    };

    try {
      await page.setContent('<button>Wrong action</button><div id="modal" style="display:none">Form</div>');
      const healer = new HealingOrchestrator(page, { warn: () => undefined } as any, fakeAi);
      await expect(healer.click(plan, {
        postCondition: {
          description: 'Intended form becomes visible',
          timeoutMs: 100,
          intervalMs: 25,
          verify: () => page.locator('#modal').isVisible()
        }
      })).rejects.toThrow(/Post-condition failed/);

      const cachePath = resolve('.healing', app, 'locator-cache.json');
      const { existsSync } = await import('node:fs');
      if (existsSync(cachePath)) {
        const cache = JSON.parse(await readFile(cachePath, 'utf8'));
        expect(cache[plan.id]).toBeUndefined();
      }
      const audit = await readFile(resolve('reports', app, 'healing', 'healing-audit.jsonl'), 'utf8');
      expect(audit).toContain('"outcome":"rejected"');
    } finally {
      await rm(resolve('.healing', app), { recursive: true, force: true });
      await rm(resolve('reports', app), { recursive: true, force: true });
      if (previous.app === undefined) delete process.env.APP; else process.env.APP = previous.app;
      if (previous.mode === undefined) delete process.env.HEALING_MODE; else process.env.HEALING_MODE = previous.mode;
      if (previous.ai === undefined) delete process.env.HEALING_AI_ENABLED; else process.env.HEALING_AI_ENABLED = previous.ai;
    }
  });
});

test.describe('Robust semantic locator recovery', () => {
  test('role namePattern tolerates Create/Add/New User copy changes without AI', async ({ page }) => {
    await page.setContent('<button id="entry">+ New User</button>');
    const healer = new HealingOrchestrator(page, { warn: () => undefined } as any);
    const plan: LocatorPlan = {
      id: 'contract.semantic-role-pattern',
      businessName: 'Open Create User',
      primary: {
        type: 'role',
        role: 'button',
        namePattern: '(?:\\b(?:create|add|new)\\b.*\\buser\\b|\\buser\\b.*\\b(?:create|add|new)\\b)',
        namePatternFlags: 'i'
      }
    };
    const previousMode = process.env.HEALING_MODE;
    process.env.HEALING_MODE = 'off';
    try {
      const locator = await healer.resolve(plan);
      await expect(locator).toHaveAttribute('id', 'entry');
    } finally {
      if (previousMode === undefined) delete process.env.HEALING_MODE; else process.env.HEALING_MODE = previousMode;
    }
  });

  test('reviewed deterministic fallback executes in suggest mode and validates business state', async ({ page }) => {
    await page.setContent(`
      <button data-bs-target="#user-modal" onclick="document.querySelector('#user-modal').style.display='block'">Open</button>
      <div id="user-modal" style="display:none">User form</div>
    `);
    const healer = new HealingOrchestrator(page, { warn: () => undefined } as any);
    const plan: LocatorPlan = {
      id: 'contract.suggest-deterministic-fallback',
      businessName: 'Open Create User',
      primary: { type: 'role', role: 'button', name: 'Missing', exact: true },
      fallbacks: [{ type: 'css', value: '[data-bs-target="#user-modal"]' }]
    };
    const previousMode = process.env.HEALING_MODE;
    process.env.HEALING_MODE = 'suggest';
    try {
      await healer.click(plan, {
        retryOnPostConditionFailure: true,
        postCondition: {
          description: 'User modal becomes visible',
          timeoutMs: 250,
          intervalMs: 25,
          verify: () => page.locator('#user-modal').isVisible()
        }
      });
      await expect(page.locator('#user-modal')).toBeVisible();
    } finally {
      if (previousMode === undefined) delete process.env.HEALING_MODE; else process.env.HEALING_MODE = previousMode;
    }
  });

  test('failed resolution includes visible-control diagnostics', async ({ page }) => {
    await page.setContent('<button>Dashboard</button><a href="#">Profile</a>');
    const healer = new HealingOrchestrator(page, { warn: () => undefined } as any);
    const plan: LocatorPlan = {
      id: 'contract.resolution-diagnostics',
      businessName: 'Open Create User',
      primary: { type: 'role', role: 'button', name: 'Missing', exact: true }
    };
    const previousMode = process.env.HEALING_MODE;
    process.env.HEALING_MODE = 'suggest';
    try {
      await expect(healer.resolve(plan)).rejects.toThrow(/Visible controls:.*Dashboard.*Profile/);
    } finally {
      if (previousMode === undefined) delete process.env.HEALING_MODE; else process.env.HEALING_MODE = previousMode;
    }
  });
});
