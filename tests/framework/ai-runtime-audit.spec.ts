import { expect, test } from '@playwright/test';
import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AiGateway } from '../../src/framework/ai/ai.gateway.js';
import type { AiProvider } from '../../src/framework/ai/ai.types.js';

/** Regression protection for provider/model runtime evidence without prompt persistence. */
test('AI runtime audit records actual provider/model but not request evidence', async () => {
  const previous = { app: process.env.APP, enabled: process.env.AI_ENABLED, healing: process.env.HEALING_AI_ENABLED, logging: process.env.AI_RUNTIME_LOGGING };
  const app = `ai-audit-${Date.now()}`;
  process.env.APP = app;
  process.env.AI_ENABLED = 'true';
  process.env.HEALING_AI_ENABLED = 'true';
  process.env.AI_RUNTIME_LOGGING = 'false';

  const provider: AiProvider = {
    async proposeLocator() {
      return {
        descriptor: { type: 'placeholder', value: 'Recovered' },
        confidence: 0.99,
        reason: 'Synthetic contract result',
        provider: 'gemini',
        model: 'gemini-contract-model',
        latencyMs: 12
      };
    }
  };

  try {
    const gateway = new AiGateway(provider, 'audit-test');
    await gateway.proposeLocator({
      planId: 'audit.plan',
      businessName: 'Sensitive input',
      accessibilitySnapshot: 'SECRET-SNAPSHOT-MUST-NOT-BE-PERSISTED',
      allowedDescriptorTypes: ['placeholder']
    });

    const file = resolve('reports', app, 'ai', 'ai-audit.jsonl');
    const content = await readFile(file, 'utf8');
    const record = JSON.parse(content.trim());
    expect(record.provider).toBe('gemini');
    expect(record.model).toBe('gemini-contract-model');
    expect(record.purpose).toBe('healing');
    expect(record.status).toBe('success');
    expect(content).not.toContain('SECRET-SNAPSHOT-MUST-NOT-BE-PERSISTED');
  } finally {
    await rm(resolve('reports', app), { recursive: true, force: true });
    if (previous.app === undefined) delete process.env.APP; else process.env.APP = previous.app;
    if (previous.enabled === undefined) delete process.env.AI_ENABLED; else process.env.AI_ENABLED = previous.enabled;
    if (previous.healing === undefined) delete process.env.HEALING_AI_ENABLED; else process.env.HEALING_AI_ENABLED = previous.healing;
    if (previous.logging === undefined) delete process.env.AI_RUNTIME_LOGGING; else process.env.AI_RUNTIME_LOGGING = previous.logging;
  }
});
