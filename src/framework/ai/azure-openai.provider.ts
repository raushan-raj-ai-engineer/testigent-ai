import type { AiHealingRequest, AiHealingResponse, AiProvider, AiProviderHealth } from './ai.types';
import { buildHealingPrompt, buildSummaryPrompt, extractOpenAiResponseText, fetchWithTimeout, HEALING_OUTPUT_SCHEMA, parseHealingJson } from './ai-provider.utils';

/**
 * Author: Raushan Raj
 * Business Use: Azure OpenAI v1 Responses provider for enterprises standardizing AI access through Azure.
 * How to use: AI_PROVIDER=azure-openai, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY and AZURE_OPENAI_MODEL (deployment/model name).
 * Benefit: Same framework contract as OpenAI/Ollama while allowing Azure governance, networking and secret-management controls.
 */
export class AzureOpenAiProvider implements AiProvider {
  private readonly endpoint = (process.env.AZURE_OPENAI_ENDPOINT ?? '').replace(/\/$/, '');
  private readonly apiKey = process.env.AZURE_OPENAI_API_KEY ?? '';
  private readonly model = process.env.AZURE_OPENAI_MODEL ?? '';
  private readonly timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 30_000);

  async proposeLocator(request: AiHealingRequest): Promise<AiHealingResponse | undefined> {
    if (!this.endpoint || !this.apiKey || !this.model) return undefined;
    const prompt = buildHealingPrompt(request);
    const started = Date.now();
    const content = await this.responses(prompt.system, prompt.user, {
      type: 'json_schema', name: 'locator_healing', strict: true, schema: HEALING_OUTPUT_SCHEMA
    });
    return parseHealingJson(content, { provider: 'azure-openai', model: this.model, latencyMs: Date.now() - started });
  }

  async summarizeFailures(payload: unknown): Promise<string | undefined> {
    if (!this.endpoint || !this.apiKey || !this.model) return undefined;
    const prompt = buildSummaryPrompt(payload);
    return this.responses(prompt.system, prompt.user);
  }

  async healthCheck(): Promise<AiProviderHealth> {
    if (!this.endpoint) return { ok: false, provider: 'azure-openai', model: this.model, message: 'AZURE_OPENAI_ENDPOINT is not configured.' };
    if (!this.apiKey) return { ok: false, provider: 'azure-openai', model: this.model, message: 'AZURE_OPENAI_API_KEY is not configured.' };
    if (!this.model) return { ok: false, provider: 'azure-openai', message: 'AZURE_OPENAI_MODEL is not configured.' };
    return { ok: true, provider: 'azure-openai', model: this.model, message: `Azure OpenAI configuration is present for '${this.endpoint}/openai/v1' and model/deployment '${this.model}'.` };
  }

  private async responses(system: string, user: string, format?: object): Promise<string | undefined> {
    try {
      const response = await fetchWithTimeout(`${this.endpoint}/openai/v1/responses`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'api-key': this.apiKey },
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
