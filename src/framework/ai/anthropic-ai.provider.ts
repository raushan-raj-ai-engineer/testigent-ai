import type { AiHealingRequest, AiHealingResponse, AiProvider, AiProviderHealth } from './ai.types';
import { resolveAiTimeoutMs, buildHealingPrompt, buildSummaryPrompt, fetchWithTimeout, HEALING_OUTPUT_SCHEMA, parseHealingJson } from './ai-provider.utils';

interface AnthropicResponse { content?: Array<{ type?: string; text?: string }> }

/**
 * Author: Raushan Raj
 * Business Use: Anthropic Claude Messages API provider for structured locator healing and grounded report narratives.
 * How to use: AI_PROVIDER=anthropic plus ANTHROPIC_API_KEY and ANTHROPIC_MODEL.
 * Benefit: Allows organizations using Claude to reuse the same tests, healing policy and reporting contracts.
 */
export class AnthropicAiProvider implements AiProvider {
  private readonly apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  private readonly model = process.env.ANTHROPIC_MODEL ?? '';
  private readonly baseUrl = (process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com').replace(/\/$/, '');
  private readonly timeoutMs = resolveAiTimeoutMs();
  private readonly maxTokens = Number(process.env.ANTHROPIC_MAX_TOKENS ?? 800);

  async proposeLocator(request: AiHealingRequest): Promise<AiHealingResponse | undefined> {
    if (!this.apiKey || !this.model) return undefined;
    const prompt = buildHealingPrompt(request);
    const started = Date.now();
    const content = await this.messages(prompt.system, prompt.user, HEALING_OUTPUT_SCHEMA);
    return parseHealingJson(content, { provider: 'anthropic', model: this.model, latencyMs: Date.now() - started });
  }

  async summarizeFailures(payload: unknown): Promise<string | undefined> {
    if (!this.apiKey || !this.model) return undefined;
    const prompt = buildSummaryPrompt(payload);
    return this.messages(prompt.system, prompt.user);
  }

  async healthCheck(): Promise<AiProviderHealth> {
    if (!this.apiKey) return { ok: false, provider: 'anthropic', model: this.model, message: 'ANTHROPIC_API_KEY is not configured.' };
    if (!this.model) return { ok: false, provider: 'anthropic', message: 'ANTHROPIC_MODEL is not configured.' };
    return { ok: true, provider: 'anthropic', model: this.model, message: `Anthropic configuration is present for model '${this.model}'.` };
  }

  private async messages(system: string, user: string, schema?: object): Promise<string | undefined> {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: this.maxTokens,
          system,
          messages: [{ role: 'user', content: user }],
          ...(schema ? { output_config: { format: { type: 'json_schema', schema } } } : {})
        })
      }, this.timeoutMs);
      if (!response.ok) return undefined;
      const body = await response.json() as AnthropicResponse;
      return body.content?.find(item => item.type === 'text' && item.text)?.text?.trim();
    } catch {
      return undefined;
    }
  }
}
