import type { AiHealingRequest, AiHealingResponse, AiProvider, AiProviderHealth } from './ai.types';
import {
  buildHealingPrompt,
  buildSummaryPrompt,
  fetchWithTimeout,
  HEALING_OUTPUT_SCHEMA,
  parseHealingJson
} from './ai-provider.utils';
import { AiProviderError } from './ai-provider.error';

interface GeminiInteractionResponse {
  model?: string;
  status?: string;
  output_text?: string;
  steps?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
}

interface GeminiErrorResponse {
  error?: {
    status?: string;
  };
}

/**
 * Author: Raushan Raj
 * Business Use: Governed Google Gemini provider for TestigentAI.
 * How to use: AI_PROVIDER=gemini plus GEMINI_API_KEY and GEMINI_MODEL.
 * Benefit: Low-latency structured locator recovery without coupling tests to the Google SDK.
 */
export class GeminiAiProvider implements AiProvider {
  private readonly apiKey = process.env.GEMINI_API_KEY ?? '';
  private readonly model = process.env.GEMINI_MODEL ?? '';
  private readonly baseUrl = (process.env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
  private readonly timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 30_000);
  private readonly thinkingLevel = (process.env.GEMINI_THINKING_LEVEL ?? 'low').toLowerCase();

  async proposeLocator(request: AiHealingRequest): Promise<AiHealingResponse | undefined> {
    if (!this.apiKey || !this.model) return undefined;

    const prompt = buildHealingPrompt(request);
    const started = Date.now();
    const content = await this.interact(prompt.system, prompt.user, HEALING_OUTPUT_SCHEMA);
    const result = parseHealingJson(content, {
      provider: 'gemini',
      model: this.model,
      latencyMs: Date.now() - started
    });

    if (!result) {
      throw new AiProviderError(
        'gemini',
        this.model,
        'invalid-response',
        'Gemini returned text that did not satisfy the governed locator-healing contract.'
      );
    }

    return result;
  }

  async summarizeFailures(payload: unknown): Promise<string | undefined> {
    if (!this.apiKey || !this.model) return undefined;
    const prompt = buildSummaryPrompt(payload);
    return this.interact(prompt.system, prompt.user);
  }

  async healthCheck(): Promise<AiProviderHealth> {
    if (!this.apiKey) {
      return { ok: false, provider: 'gemini', model: this.model, message: 'GEMINI_API_KEY is not configured.' };
    }
    if (!this.model) {
      return { ok: false, provider: 'gemini', message: 'GEMINI_MODEL is not configured.' };
    }
    if (!this.isSupportedThinkingLevel()) {
      return {
        ok: false,
        provider: 'gemini',
        model: this.model,
        message: `Unsupported GEMINI_THINKING_LEVEL='${this.thinkingLevel}'. Use low, medium or high.`
      };
    }

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

  private async interact(systemInstruction: string, input: string, schema?: object): Promise<string | undefined> {
    if (!this.isSupportedThinkingLevel()) {
      throw new AiProviderError(
        'gemini',
        this.model,
        'configuration',
        `Unsupported GEMINI_THINKING_LEVEL='${this.thinkingLevel}'. Use low, medium or high.`
      );
    }

    const modelId = this.model.replace(/^models\//, '');

    try {
      const response = await fetchWithTimeout(`${this.baseUrl}/interactions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': this.apiKey
        },
        body: JSON.stringify({
          model: modelId,
          input,
          system_instruction: systemInstruction,
          store: false,
          generation_config: {
            thinking_level: this.thinkingLevel
          },
          ...(schema ? {
            response_format: {
              type: 'text',
              mime_type: 'application/json',
              schema
            }
          } : {})
        })
      }, this.timeoutMs);

      if (!response.ok) {
        const providerCode = await this.readSafeProviderCode(response);
        throw new AiProviderError(
          'gemini',
          this.model,
          'http-error',
          `Gemini request failed with HTTP ${response.status}${providerCode ? ` (${providerCode})` : ''}.`,
          response.status,
          providerCode
        );
      }

      const body = await response.json() as GeminiInteractionResponse;
      const text = this.extractText(body);
      if (text) return text;

      throw new AiProviderError(
        'gemini',
        this.model,
        'invalid-response',
        `Gemini returned no usable model text (status=${body.status ?? 'unknown'}).`
      );
    } catch (error) {
      if (error instanceof AiProviderError) throw error;

      if (error instanceof Error && (error.name === 'AbortError' || /abort|timeout/i.test(error.message))) {
        throw new AiProviderError(
          'gemini',
          this.model,
          'timeout',
          `Gemini request exceeded AI_TIMEOUT_MS=${this.timeoutMs}.`
        );
      }

      throw new AiProviderError(
        'gemini',
        this.model,
        'network-error',
        `Gemini network request failed (${error instanceof Error ? error.name : 'UnknownError'}).`
      );
    }
  }

  private extractText(body: GeminiInteractionResponse): string | undefined {
    if (typeof body.output_text === 'string' && body.output_text.trim()) return body.output_text.trim();

    for (const step of body.steps ?? []) {
      if (step.type !== 'model_output') continue;
      const text = step.content?.find(
        item => item.type === 'text' && typeof item.text === 'string' && item.text.trim()
      )?.text;
      if (text?.trim()) return text.trim();
    }

    return undefined;
  }

  private async readSafeProviderCode(response: Response): Promise<string | undefined> {
    try {
      const body = await response.clone().json() as GeminiErrorResponse;
      const status = body.error?.status;
      return typeof status === 'string' && /^[A-Z0-9_]{1,80}$/.test(status) ? status : undefined;
    } catch {
      return undefined;
    }
  }

  private isSupportedThinkingLevel(): boolean {
    return ['low', 'medium', 'high'].includes(this.thinkingLevel);
  }
}
