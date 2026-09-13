import { test, expect } from '@playwright/test';
import { GeminiAiProvider } from '../../src/framework/ai/gemini-ai.provider';
import type { AiHealingRequest } from '../../src/framework/ai/ai.types';

const originalFetch = globalThis.fetch;
const envKeys = ['GEMINI_API_KEY','GEMINI_MODEL','AI_ALLOW_CLOUD_EGRESS','AI_ALLOWED_EXTERNAL_ORIGINS','AI_TIMEOUT_MS','AI_TOTAL_TIMEOUT_MS','AI_RETRY_MAX_ATTEMPTS','AI_RETRY_BASE_DELAY_MS','AI_RETRY_MAX_DELAY_MS','AI_RETRY_JITTER_MS','AI_RETRY_ON_TIMEOUT'] as const;
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]])) as Record<(typeof envKeys)[number], string | undefined>;

function configureRetryPolicy(overrides: Record<string, string> = {}): void {
  Object.assign(process.env, {
    GEMINI_API_KEY: 'contract-key',
    GEMINI_MODEL: 'contract-model',
    AI_ALLOW_CLOUD_EGRESS: 'true',
    AI_ALLOWED_EXTERNAL_ORIGINS: 'https://generativelanguage.googleapis.com',
    AI_TIMEOUT_MS: '600',
    AI_TOTAL_TIMEOUT_MS: '900',
    AI_RETRY_MAX_ATTEMPTS: '3',
    AI_RETRY_BASE_DELAY_MS: '0',
    AI_RETRY_MAX_DELAY_MS: '0',
    AI_RETRY_JITTER_MS: '0',
    AI_RETRY_ON_TIMEOUT: 'true',
    ...overrides
  });
}
function successResponse(): Response {
  return new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify({ descriptor: { type: 'role', role: 'textbox', name: 'Search', value: '' }, confidence: 0.99, reason: 'Exact semantic match' }) }] } }]
  }), { status: 200, headers: { 'content-type': 'application/json' } });
}
function request(): AiHealingRequest {
  return {
    planId: 'retry-contract',
    businessName: 'Search input',
    accessibilitySnapshot: '- textbox "Search"',
    allowedDescriptorTypes: ['role']
  };
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test.describe('Gemini retry budget contract', () => {
  test('transient 503 responses can reach the third configured attempt', async () => {
    configureRetryPolicy({ AI_TIMEOUT_MS: '300', AI_TOTAL_TIMEOUT_MS: '1200' });
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls < 3) return new Response(JSON.stringify({ error: { status: 'UNAVAILABLE' } }), { status: 503, headers: { 'content-type': 'application/json' } });
      return successResponse();
    };
    const result = await new GeminiAiProvider().proposeLocator(request());
    expect(calls).toBe(3);
    expect(result?.descriptor).toMatchObject({ type: 'role', role: 'textbox', name: 'Search' });
  });

  test('fair attempt budgeting leaves time for a retry after a timeout', async () => {
    configureRetryPolicy();
    let calls = 0;
    let firstElapsed = 0;
    globalThis.fetch = async (_input, init) => {
      calls += 1;
      if (calls > 1) return successResponse();
      const started = Date.now();
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          firstElapsed = Date.now() - started;
          const error = new Error('aborted by retry contract');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      });
    };
    const result = await new GeminiAiProvider().proposeLocator(request());
    expect(calls).toBe(2);
    expect(firstElapsed).toBeLessThan(500);
    expect(result).toBeDefined();
  });

  test('permanent 4xx responses fail immediately without retry', async () => {
    configureRetryPolicy({ AI_TIMEOUT_MS: '300', AI_TOTAL_TIMEOUT_MS: '1200' });
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT' } }), { status: 400, headers: { 'content-type': 'application/json' } });
    };
    await expect(new GeminiAiProvider().proposeLocator(request())).rejects.toThrow(/HTTP 400/);
    expect(calls).toBe(1);
  });
});
