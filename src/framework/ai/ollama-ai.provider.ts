import type { AiHealingRequest, AiHealingResponse, AiProvider, AiProviderHealth } from './ai.types';
import { buildHealingPrompt, buildSummaryPrompt, fetchWithTimeout, HEALING_OUTPUT_SCHEMA, parseHealingJson } from './ai-provider.utils';

interface OllamaChatResponse { message?: { content?: string }; done?: boolean; model?: string }
interface OllamaTagsResponse { models?: Array<{ name?: string; model?: string }> }

/**
 * Author: Raushan Raj
 * Business Use: Local/private AI provider for Playwright healing and business failure summaries through Ollama.
 * How to use: AI_PROVIDER=ollama with OLLAMA_BASE_URL and OLLAMA_MODEL (default llama3.2).
 * Benefit: Keeps evidence local, avoids per-call cloud token cost and uses the same provider-neutral AI Gateway.
 */
export class OllamaAiProvider implements AiProvider {
  private readonly baseUrl = (process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434').replace(/\/$/, '');
  private readonly model = process.env.OLLAMA_MODEL ?? 'llama3.2';
  private readonly timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 30_000);
  private readonly temperature = Number(process.env.OLLAMA_TEMPERATURE ?? 0.1);
  private readonly keepAlive = process.env.OLLAMA_KEEP_ALIVE ?? '5m';
  private readonly numCtx = Number(process.env.OLLAMA_NUM_CTX ?? 8192);
  private readonly numPredict = Number(process.env.OLLAMA_NUM_PREDICT ?? 500);

  async proposeLocator(request: AiHealingRequest): Promise<AiHealingResponse | undefined> {
    const prompt = buildHealingPrompt(request);
    const started = Date.now();
    const content = await this.chat(
      [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
      HEALING_OUTPUT_SCHEMA
    );
    return parseHealingJson(content, { provider: 'ollama', model: this.model, latencyMs: Date.now() - started });
  }

  async summarizeFailures(payload: unknown): Promise<string | undefined> {
    const prompt = buildSummaryPrompt(payload);
    return this.chat([{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }]);
  }

  async healthCheck(): Promise<AiProviderHealth> {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/api/tags`, { method: 'GET' }, this.timeoutMs);
      if (!response.ok) return { ok: false, provider: 'ollama', model: this.model, message: `Ollama returned HTTP ${response.status}` };
      const body = await response.json() as OllamaTagsResponse;
      const models = (body.models ?? []).flatMap(item => [item.name, item.model]).filter(Boolean) as string[];
      const normalized = this.model.includes(':') ? this.model : `${this.model}:latest`;
      const found = models.some(name => name === this.model || name === normalized || name.startsWith(`${this.model}:`));
      return found
        ? { ok: true, provider: 'ollama', model: this.model, message: `Ollama is reachable and model '${this.model}' is installed.` }
        : { ok: false, provider: 'ollama', model: this.model, message: `Ollama is reachable but model '${this.model}' was not found. Run: ollama pull ${this.model}` };
    } catch (error) {
      return { ok: false, provider: 'ollama', model: this.model, message: `Ollama is not reachable at ${this.baseUrl}: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  private async chat(messages: Array<{ role: 'system' | 'user'; content: string }>, format?: object): Promise<string | undefined> {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          stream: false,
          ...(format ? { format } : {}),
          keep_alive: this.keepAlive,
          options: { temperature: this.temperature, num_ctx: this.numCtx, num_predict: this.numPredict }
        })
      }, this.timeoutMs);
      if (!response.ok) return undefined;
      const body = await response.json() as OllamaChatResponse;
      return body.message?.content?.trim() || undefined;
    } catch {
      return undefined;
    }
  }
}
