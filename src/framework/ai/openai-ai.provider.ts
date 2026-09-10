import type { AiHealingRequest, AiHealingResponse, AiProvider, AiProviderHealth } from './ai.types';
import { buildHealingPrompt, buildSummaryPrompt, extractOpenAiResponseText, fetchWithTimeout, HEALING_OUTPUT_SCHEMA, parseHealingJson } from './ai-provider.utils';

/**
 * Author: Raushan Raj
 * Business Use: OpenAI Responses API provider for governed healing and business failure analysis.
 * How to use: AI_PROVIDER=openai plus OPENAI_API_KEY and OPENAI_MODEL.
 * Benefit: Uses native structured outputs while keeping vendor code behind the common AiProvider contract.
 */
export class OpenAiProvider implements AiProvider {
  private readonly apiKey = process.env.OPENAI_API_KEY ?? '';
  private readonly model = process.env.OPENAI_MODEL ?? '';
  private readonly baseUrl = (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  private readonly timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 30_000);

  async proposeLocator(request: AiHealingRequest): Promise<AiHealingResponse | undefined> {
    if (!this.apiKey || !this.model) return undefined;
    const prompt = buildHealingPrompt(request);
    const started = Date.now();
    const content = await this.responses(prompt.system, prompt.user, {
      type: 'json_schema', name: 'locator_healing', strict: true, schema: HEALING_OUTPUT_SCHEMA
    });
    return parseHealingJson(content, { provider: 'openai', model: this.model, latencyMs: Date.now() - started });
  }

  async summarizeFailures(payload: unknown): Promise<string | undefined> {
    if (!this.apiKey || !this.model) return undefined;
    const prompt = buildSummaryPrompt(payload);
    return this.responses(prompt.system, prompt.user);
  }

  async healthCheck(): Promise<AiProviderHealth> {
    if (!this.apiKey) return { ok: false, provider: 'openai', model: this.model, message: 'OPENAI_API_KEY is not configured.' };
    if (!this.model) return { ok: false, provider: 'openai', message: 'OPENAI_MODEL is not configured.' };
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/models`, { headers: { authorization: `Bearer ${this.apiKey}` } }, this.timeoutMs);
      return response.ok
        ? { ok: true, provider: 'openai', model: this.model, message: `OpenAI is reachable; configured model is '${this.model}'.` }
        : { ok: false, provider: 'openai', model: this.model, message: `OpenAI returned HTTP ${response.status}.` };
    } catch (error) {
      return { ok: false, provider: 'openai', model: this.model, message: `OpenAI is not reachable: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  private async responses(system: string, user: string, format?: object): Promise<string | undefined> {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/responses`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          instructions: system,
          input: user,
          store: false,
          ...(format ? { text: { format } } : {})
        })
      }, this.timeoutMs);
      if (!response.ok) return undefined;
      return extractOpenAiResponseText(await response.json());
    } catch {
      return undefined;
    }
  }
}
