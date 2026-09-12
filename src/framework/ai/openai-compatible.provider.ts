import type { AiHealingRequest, AiHealingResponse, AiProvider, AiProviderHealth } from './ai.types';
import { resolveAiTimeoutMs, buildHealingPrompt, buildSummaryPrompt, fetchWithTimeout, HEALING_OUTPUT_SCHEMA, parseHealingJson } from './ai-provider.utils';
import { assertAiDestinationAllowed } from './ai-egress.policy';

interface CompatibleResponse { choices?: Array<{ message?: { content?: string } }> }

/**
 * Author: Raushan Raj
 * Business Use: Adapter for services exposing an OpenAI-compatible Chat Completions endpoint (for example approved gateways/local servers).
 * How to use: AI_PROVIDER=openai-compatible, AI_COMPAT_BASE_URL, AI_COMPAT_MODEL and optional AI_COMPAT_API_KEY.
 * Benefit: Adds many providers without creating vendor logic in tests; structured mode can be relaxed per gateway capability.
 */
export class OpenAiCompatibleProvider implements AiProvider {
  private readonly baseUrl = (process.env.AI_COMPAT_BASE_URL ?? '').replace(/\/$/, '');
  private readonly apiKey = process.env.AI_COMPAT_API_KEY ?? '';
  private readonly model = process.env.AI_COMPAT_MODEL ?? '';
  private readonly mode = process.env.AI_COMPAT_STRUCTURED_MODE ?? 'json_schema';
  private readonly timeoutMs = resolveAiTimeoutMs();

  async proposeLocator(request: AiHealingRequest): Promise<AiHealingResponse | undefined> {
    if (!this.baseUrl || !this.model) return undefined;
    const prompt = buildHealingPrompt(request);
    const started = Date.now();
    const content = await this.chat(prompt.system, prompt.user, true);
    return parseHealingJson(content, { provider: 'openai-compatible', model: this.model, latencyMs: Date.now() - started });
  }

  async summarizeFailures(payload: unknown): Promise<string | undefined> {
    if (!this.baseUrl || !this.model) return undefined;
    const prompt = buildSummaryPrompt(payload);
    return this.chat(prompt.system, prompt.user, false);
  }

  async healthCheck(): Promise<AiProviderHealth> {
    if (!this.baseUrl) return { ok: false, provider: 'openai-compatible', model: this.model, message: 'AI_COMPAT_BASE_URL is not configured.' };
    if (!this.model) return { ok: false, provider: 'openai-compatible', message: 'AI_COMPAT_MODEL is not configured.' };
    try {
      const decision = assertAiDestinationAllowed(this.baseUrl);
      return { ok: true, provider: 'openai-compatible', model: this.model, message: `OpenAI-compatible destination approved at '${decision.origin}' with model '${this.model}'.` };
    } catch (error) {
      return { ok: false, provider: 'openai-compatible', model: this.model, message: error instanceof Error ? error.message : String(error) };
    }
  }

  private async chat(system: string, user: string, structured: boolean): Promise<string | undefined> {
    try {
      const responseFormat = structured && this.mode === 'json_schema'
        ? { response_format: { type: 'json_schema', json_schema: { name: 'locator_healing', strict: true, schema: HEALING_OUTPUT_SCHEMA } } }
        : structured && this.mode === 'json_object'
          ? { response_format: { type: 'json_object' } }
          : {};
      const response = await fetchWithTimeout(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {})
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          ...responseFormat
        })
      }, this.timeoutMs);
      if (!response.ok) return undefined;
      const body = await response.json() as CompatibleResponse;
      return body.choices?.[0]?.message?.content?.trim();
    } catch {
      return undefined;
    }
  }
}
