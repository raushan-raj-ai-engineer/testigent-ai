import { expect, test } from '@playwright/test';
import { FailoverAiProvider } from '../../src/framework/ai/failover-ai.provider.js';
import { resolveProviderOrder } from '../../src/framework/ai/ai-provider.factory.js';
import type { AiHealingRequest, AiProvider } from '../../src/framework/ai/ai.types.js';

const request: AiHealingRequest = {
  planId: 'contract.ai.failover',
  businessName: 'AI failover action',
  accessibilitySnapshot: '- button "Create"',
  allowedDescriptorTypes: ['role']
};

function withEnv(values: Record<string, string | undefined>, action: () => void | Promise<void>) {
  const snapshot = { ...process.env };
  const run = async () => {
    try {
      for (const [key, value] of Object.entries(values)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      await action();
    } finally {
      for (const key of Object.keys(process.env)) if (!(key in snapshot)) delete process.env[key];
      Object.assign(process.env, snapshot);
    }
  };
  return run();
}

test.describe('AI provider selection and failover contract', () => {
  test('provider runtime failure or no-result falls through to the next explicitly ordered provider', async () => {
    const throwing: AiProvider = { async proposeLocator() { throw new Error('provider unavailable'); } };
    const empty: AiProvider = { async proposeLocator() { return undefined; } };
    const working: AiProvider = {
      async proposeLocator() {
        return {
          descriptor: { type: 'role', role: 'button', name: 'Create', exact: true },
          confidence: 0.99,
          reason: 'Unique semantic button',
          provider: 'gemini',
          model: 'configured-model'
        };
      }
    };

    const chain = new FailoverAiProvider([
      { name: 'ollama', provider: throwing },
      { name: 'openai', provider: empty },
      { name: 'gemini', provider: working }
    ]);

    const result = await chain.proposeLocator(request);
    expect(result?.provider).toBe('gemini');
    expect(result?.descriptor).toEqual({ type: 'role', role: 'button', name: 'Create', exact: true });
  });

  test('AI disabled means no provider is resolved', async () => {
    await withEnv({ AI_ENABLED: 'false', AI_PROVIDER: 'ollama', OLLAMA_MODEL: 'llama3.2' }, async () => {
      expect(resolveProviderOrder()).toEqual([]);
    });
  });

  test('single mode requires explicit provider and never defaults to Ollama', async () => {
    await withEnv({
      AI_ENABLED: 'true', AI_PROVIDER_MODE: 'single', AI_PROVIDER: undefined,
      AI_PROVIDER_ORDER: undefined, OLLAMA_MODEL: 'llama3.2'
    }, async () => {
      expect(() => resolveProviderOrder()).toThrow('AI_PROVIDER is required');
    });
  });

  test('single mode can select Ollama explicitly for local execution', async () => {
    await withEnv({
      AI_ENABLED: 'true', AI_PROVIDER_MODE: 'single', AI_PROVIDER: 'ollama',
      OLLAMA_MODEL: 'llama3.2'
    }, async () => {
      expect(resolveProviderOrder()).toEqual(['ollama']);
    });
  });

  test('single mode can select Gemini explicitly without Ollama being injected', async () => {
    await withEnv({
      AI_ENABLED: 'true', AI_PROVIDER_MODE: 'single', AI_PROVIDER: 'gemini',
      AI_ALLOW_CLOUD_EGRESS: 'true', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-test-model',
      OLLAMA_MODEL: 'llama3.2'
    }, async () => {
      expect(resolveProviderOrder()).toEqual(['gemini']);
    });
  });

  test('failover mode respects the exact fully-configured user order', async () => {
    await withEnv({
      AI_ENABLED: 'true', AI_PROVIDER_MODE: 'failover', AI_PROVIDER: undefined,
      AI_PROVIDER_ORDER: 'gemini,ollama,openai', AI_ALLOW_CLOUD_EGRESS: 'true',
      GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-test-model',
      OLLAMA_MODEL: 'llama3.2', OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'test-model'
    }, async () => {
      expect(resolveProviderOrder()).toEqual(['gemini', 'ollama', 'openai']);
    });
  });

  test('failover mode fails fast when a listed provider is not configured', async () => {
    await withEnv({
      AI_ENABLED: 'true', AI_PROVIDER_MODE: 'failover', AI_PROVIDER_ORDER: 'gemini,openai',
      AI_ALLOW_CLOUD_EGRESS: 'true', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-test-model',
      OPENAI_API_KEY: undefined, OPENAI_MODEL: undefined
    }, async () => {
      expect(() => resolveProviderOrder()).toThrow("AI provider 'openai' is missing required configuration");
    });
  });

  test('failover mode requires an explicit order', async () => {
    await withEnv({
      AI_ENABLED: 'true', AI_PROVIDER_MODE: 'failover', AI_PROVIDER_ORDER: undefined
    }, async () => {
      expect(() => resolveProviderOrder()).toThrow('AI_PROVIDER_ORDER is required');
    });
  });

  test('cloud provider fails fast unless cloud egress is explicitly allowed', async () => {
    await withEnv({
      AI_ENABLED: 'true', AI_PROVIDER_MODE: 'single', AI_PROVIDER: 'gemini',
      AI_ALLOW_CLOUD_EGRESS: 'false', GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-test-model'
    }, async () => {
      expect(() => resolveProviderOrder()).toThrow('AI_ALLOW_CLOUD_EGRESS=true');
    });
  });
});
