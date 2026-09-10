import type { AiHealingRequest, AiHealingResponse, AiProvider, AiProviderHealth } from './ai.types';
import { buildHealingPrompt, buildSummaryPrompt, fetchWithTimeout, HEALING_OUTPUT_SCHEMA, parseHealingJson } from './ai-provider.utils';

interface GeminiInteractionResponse {
  model?: string;
  steps?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
}

/**
 * Author: Raushan Raj
 * Business Use: Google Gemini Interactions API provider for organizations standardizing on Gemini.
 * How to use: AI_PROVIDER=gemini plus GEMINI_API_KEY and GEMINI_MODEL.
 * Benefit: Adds a current Gemini API path without coupling Playwright tests to the Google SDK.
 */
export class GeminiAiProvider implements AiProvider {
  private readonly apiKey = process.env.GEMINI_API_KEY ?? '';
  private readonly model = process.env.GEMINI_MODEL ?? '';
  private readonly baseUrl = (process.env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
  private readonly timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 30_000);

  async proposeLocator(request: AiHealingRequest): Promise<AiHealingResponse | undefined> {
    if (!this.apiKey || !this.model) return undefined;
    const prompt = buildHealingPrompt(request);
    const started = Date.now();
    const content = await this.interact(`${prompt.system}\n\n${prompt.user}`, HEALING_OUTPUT_SCHEMA);
    return parseHealingJson(content, { provider: 'gemini', model: this.model, latencyMs: Date.now() - started });
  }

  async summarizeFailures(payload: unknown): Promise<string | undefined> {
    if (!this.apiKey || !this.model) return undefined;
    const prompt = buildSummaryPrompt(payload);
    return this.interact(`${prompt.system}\n\n${prompt.user}`);
  }

  async healthCheck(): Promise<AiProviderHealth> {
    if (!this.apiKey) return { ok: false, provider: 'gemini', model: this.model, message: 'GEMINI_API_KEY is not configured.' };
    if (!this.model) return { ok: false, provider: 'gemini', message: 'GEMINI_MODEL is not configured.' };

    const modelId = this.model.replace(/^models\//, '');
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/models/${encodeURIComponent(modelId)}`, {
        method: 'GET',
        headers: { 'x-goog-api-key': this.apiKey }
      }, this.timeoutMs);
      if (!response.ok) {
        return {
          ok: false,
          provider: 'gemini',
          model: this.model,
          message: `Gemini model validation failed with HTTP ${response.status} for '${this.model}'.`
        };
      }
      return {
        ok: true,
        provider: 'gemini',
        model: this.model,
        message: `Gemini API key is accepted and model '${this.model}' is available.`
      };
    } catch (error) {
      return {
        ok: false,
        provider: 'gemini',
        model: this.model,
        message: `Gemini is not reachable: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async interact(input: string, schema?: object): Promise<string | undefined> {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/interactions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          model: this.model,
          input,
          ...(schema ? { response_format: { type: 'text', mime_type: 'application/json', schema } } : {})
        })
      }, this.timeoutMs);
      if (!response.ok) return undefined;
      const body = await response.json() as GeminiInteractionResponse;
      for (const step of body.steps ?? []) {
        if (step.type !== 'model_output') continue;
        const text = step.content?.find(item => item.type === 'text' && item.text)?.text?.trim();
        if (text) return text;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }
}
