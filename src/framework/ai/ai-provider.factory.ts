import type { AiProvider } from './ai.types';
import { AiGateway } from './ai.gateway';
import { AnthropicAiProvider } from './anthropic-ai.provider';
import { AzureOpenAiProvider } from './azure-openai.provider';
import { FailoverAiProvider } from './failover-ai.provider';
import { GeminiAiProvider } from './gemini-ai.provider';
import { HttpAiProvider } from './http-ai.provider';
import { OllamaAiProvider } from './ollama-ai.provider';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';
import { OpenAiProvider } from './openai-ai.provider';

export type SupportedAiProvider = 'ollama' | 'openai' | 'anthropic' | 'azure-openai' | 'gemini' | 'openai-compatible' | 'http';
export type AiProviderMode = 'single' | 'failover';

/**
 * Author: Raushan Raj
 * Business Use: Central LLM provider registry with explicit user/CI controlled provider selection.
 * How to use: Set AI_ENABLED=true, AI_PROVIDER_MODE=single + AI_PROVIDER=<provider>, or
 *             AI_PROVIDER_MODE=failover + AI_PROVIDER_ORDER=<provider1,provider2,...>.
 * Benefit: No provider is silently imposed. Local and CI users choose the provider(s) allowed for that environment.
 */
export function createAiProvider(): AiProvider | undefined {
  if (process.env.AI_ENABLED !== 'true') return undefined;

  const names = resolveProviderOrder();
  const providers = names.map(name => ({ name, provider: createSingleProvider(name) }));
  if (providers.length === 0) return undefined;
  return providers.length === 1 ? providers[0].provider : new FailoverAiProvider(providers);
}

/**
 * Reusable framework function `createAiGateway`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export function createAiGateway(testId?: string): AiGateway | undefined {
  const provider = createAiProvider();
  return provider ? new AiGateway(provider, testId) : undefined;
}

/**
 * Exposed for framework contract tests and diagnostics.
 * No implicit provider default exists when AI is enabled.
 */
export function resolveProviderOrder(): SupportedAiProvider[] {
  if (process.env.AI_ENABLED !== 'true') return [];

  const mode = normalizeMode(process.env.AI_PROVIDER_MODE ?? 'single');

  if (mode === 'single') {
    const configured = process.env.AI_PROVIDER?.trim();
    if (!configured) {
      throw new Error('AI_PROVIDER is required when AI_ENABLED=true and AI_PROVIDER_MODE=single.');
    }
    const provider = normalizeProvider(configured);
    assertProviderConfiguredAndAllowed(provider);
    return [provider];
  }

  const order = (process.env.AI_PROVIDER_ORDER ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .map(normalizeProvider);

  if (order.length === 0) {
    throw new Error('AI_PROVIDER_ORDER is required when AI_PROVIDER_MODE=failover.');
  }

  const providers = unique(order);
  for (const provider of providers) assertProviderConfiguredAndAllowed(provider);
  return providers;
}

/**
 * Reusable framework function `createSingleProvider`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export function createSingleProvider(name: SupportedAiProvider): AiProvider {
  enforceCloudEgressPolicy(name);
  switch (name) {
    case 'ollama': return new OllamaAiProvider();
    case 'openai': return new OpenAiProvider();
    case 'anthropic': return new AnthropicAiProvider();
    case 'azure-openai': return new AzureOpenAiProvider();
    case 'gemini': return new GeminiAiProvider();
    case 'openai-compatible': return new OpenAiCompatibleProvider();
    case 'http': return new HttpAiProvider();
  }
}

function assertProviderConfiguredAndAllowed(name: SupportedAiProvider): void {
  if (isCloudProvider(name) && process.env.AI_ALLOW_CLOUD_EGRESS !== 'true') {
    throw new Error(`AI provider '${name}' requires AI_ALLOW_CLOUD_EGRESS=true.`);
  }

  const required: Partial<Record<SupportedAiProvider, string[]>> = {
    openai: ['OPENAI_API_KEY', 'OPENAI_MODEL'],
    'azure-openai': ['AZURE_OPENAI_ENDPOINT', 'AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_MODEL'],
    gemini: ['GEMINI_API_KEY', 'GEMINI_MODEL'],
    anthropic: ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL'],
    'openai-compatible': ['AI_COMPAT_BASE_URL', 'AI_COMPAT_MODEL'],
    http: ['AI_ENDPOINT']
  };

  const missing = (required[name] ?? []).filter(key => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`AI provider '${name}' is missing required configuration: ${missing.join(', ')}.`);
  }
}

function normalizeMode(value: string): AiProviderMode {
  const normalized = value.trim().toLowerCase();
  if (normalized !== 'single' && normalized !== 'failover') {
    throw new Error(`Unsupported AI_PROVIDER_MODE '${value}'. Supported values: single, failover.`);
  }
  return normalized;
}

function normalizeProvider(value: string): SupportedAiProvider {
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, SupportedAiProvider> = {
    azure: 'azure-openai', azureopenai: 'azure-openai', claude: 'anthropic',
    google: 'gemini', compatible: 'openai-compatible', openaicompatible: 'openai-compatible'
  };
  const result = aliases[normalized] ?? normalized;
  const allowed: SupportedAiProvider[] = ['ollama', 'openai', 'anthropic', 'azure-openai', 'gemini', 'openai-compatible', 'http'];
  if (!allowed.includes(result as SupportedAiProvider)) {
    throw new Error(`Unsupported AI provider '${value}'. Supported values: ${allowed.join(', ')}.`);
  }
  return result as SupportedAiProvider;
}

function enforceCloudEgressPolicy(name: SupportedAiProvider): void {
  if (isCloudProvider(name) && process.env.AI_ALLOW_CLOUD_EGRESS !== 'true') {
    throw new Error(`AI provider '${name}' requires AI_ALLOW_CLOUD_EGRESS=true. This guard prevents accidental external transmission of test evidence.`);
  }
}

function isCloudProvider(name: SupportedAiProvider): boolean {
  return ['openai', 'anthropic', 'azure-openai', 'gemini'].includes(name);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
