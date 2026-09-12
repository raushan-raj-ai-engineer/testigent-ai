import type { AiHealingRequest, AiHealingResponse, AiProvider, AiProviderHealth } from './ai.types';
import {
  buildHealingPrompt,
  buildSummaryPrompt,
  fetchWithTimeout,
  HEALING_OUTPUT_SCHEMA,
  parseHealingJson,
  resolveAiTimeoutMs
} from './ai-provider.utils';
import { AiProviderError } from './ai-provider.error';

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    finishReason?: string;
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
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
 *
 * Reliability policy:
 * - Retry only transient provider/network failures.
 * - Never retry permanent 4xx configuration/auth failures.
 * - Use exponential backoff + jitter.
 * - Bound all attempts by AI_TOTAL_TIMEOUT_MS so provider retries cannot consume the entire test indefinitely.
 */
/**
 * Reusable framework class `GeminiAiProvider`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export class GeminiAiProvider implements AiProvider {
  private readonly apiKey = process.env.GEMINI_API_KEY ?? '';
  private readonly model = process.env.GEMINI_MODEL ?? '';
  private readonly baseUrl = (process.env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
  private readonly timeoutMs = resolveAiTimeoutMs();
  private readonly totalTimeoutMs = Number(process.env.AI_TOTAL_TIMEOUT_MS ?? 90_000);
  private readonly maxAttempts = Number(process.env.AI_RETRY_MAX_ATTEMPTS ?? 3);
  private readonly retryBaseDelayMs = Number(process.env.AI_RETRY_BASE_DELAY_MS ?? 1_000);
  private readonly retryMaxDelayMs = Number(process.env.AI_RETRY_MAX_DELAY_MS ?? 8_000);
  private readonly retryJitterMs = Number(process.env.AI_RETRY_JITTER_MS ?? 250);
  private readonly retryOnTimeout = (process.env.AI_RETRY_ON_TIMEOUT ?? 'false').toLowerCase() === 'true';
  private readonly thinkingLevel = (process.env.GEMINI_THINKING_LEVEL ?? 'low').toLowerCase();
  private readonly maxOutputTokens = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? 512);

  async proposeLocator(request: AiHealingRequest): Promise<AiHealingResponse | undefined> {
    if (!this.apiKey || !this.model) return undefined;

    const prompt = buildHealingPrompt(request);
    const started = Date.now();
    const content = await this.generateContent(prompt.system, prompt.user, HEALING_OUTPUT_SCHEMA);
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
    return this.generateContent(prompt.system, prompt.user);
  }

  async healthCheck(): Promise<AiProviderHealth> {
    if (!this.apiKey) {
      return { ok: false, provider: 'gemini', model: this.model, message: 'GEMINI_API_KEY is not configured.' };
    }
    if (!this.model) {
      return { ok: false, provider: 'gemini', message: 'GEMINI_MODEL is not configured.' };
    }

    const configError = this.configurationError();
    if (configError) {
      return { ok: false, provider: 'gemini', model: this.model, message: configError };
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

  private async generateContent(
    systemInstruction: string,
    input: string,
    schema?: object
  ): Promise<string | undefined> {
    const configError = this.configurationError();
    if (configError) {
      throw new AiProviderError('gemini', this.model, 'configuration', configError);
    }

    const modelId = this.model.replace(/^models\//, '');
    const endpoint = `${this.baseUrl}/models/${encodeURIComponent(modelId)}:generateContent`;
    const totalStarted = Date.now();

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      const remainingBeforeAttempt = this.remainingBudget(totalStarted);
      if (remainingBeforeAttempt <= 0) {
        throw new AiProviderError(
          'gemini',
          this.model,
          'timeout',
          `Gemini retry budget exceeded AI_TOTAL_TIMEOUT_MS=${this.totalTimeoutMs}.`,
          undefined,
          undefined,
          attempt - 1
        );
      }

      const attemptTimeoutMs = Math.max(1, Math.min(this.timeoutMs, remainingBeforeAttempt));

      try {
        const response = await fetchWithTimeout(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': this.apiKey
          },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemInstruction }]
            },
            contents: [{
              role: 'user',
              parts: [{ text: input }]
            }],
            generationConfig: {
              thinkingConfig: {
                thinkingLevel: this.thinkingLevel
              },
              maxOutputTokens: this.maxOutputTokens,
              ...(schema ? {
                responseMimeType: 'application/json',
                responseJsonSchema: schema
              } : {})
            },
            store: false
          })
        }, attemptTimeoutMs);

        if (!response.ok) {
          const providerCode = await this.readSafeProviderCode(response);

          if (this.isRetryableHttpStatus(response.status) && attempt < this.maxAttempts) {
            const retried = await this.waitForRetry(
              totalStarted,
              attempt,
              `HTTP_${response.status}${providerCode ? `_${providerCode}` : ''}`
            );
            if (retried) continue;
          }

          throw new AiProviderError(
            'gemini',
            this.model,
            'http-error',
            `Gemini generateContent failed with HTTP ${response.status}${providerCode ? ` (${providerCode})` : ''}.`,
            response.status,
            providerCode,
            attempt
          );
        }

        const body = await response.json() as GeminiGenerateContentResponse;
        const text = this.extractText(body);
        if (text) return text;

        const finishReason = body.candidates?.[0]?.finishReason ?? 'unknown';
        throw new AiProviderError(
          'gemini',
          this.model,
          'invalid-response',
          `Gemini generateContent returned no usable text (finishReason=${finishReason}).`,
          undefined,
          undefined,
          attempt
        );
      } catch (error) {
        if (error instanceof AiProviderError) throw error;

        const isTimeout = error instanceof Error && (
          error.name === 'AbortError' || /abort|timeout/i.test(error.message)
        );

        if (isTimeout) {
          if (this.retryOnTimeout && attempt < this.maxAttempts) {
            const retried = await this.waitForRetry(totalStarted, attempt, 'TIMEOUT');
            if (retried) continue;
          }

          throw new AiProviderError(
            'gemini',
            this.model,
            'timeout',
            `Gemini generateContent exceeded attempt timeout ${attemptTimeoutMs}ms.`,
            undefined,
            undefined,
            attempt
          );
        }

        if (attempt < this.maxAttempts) {
          const retried = await this.waitForRetry(
            totalStarted,
            attempt,
            `NETWORK_${error instanceof Error ? error.name : 'UnknownError'}`
          );
          if (retried) continue;
        }

        throw new AiProviderError(
          'gemini',
          this.model,
          'network-error',
          `Gemini generateContent network request failed (${error instanceof Error ? error.name : 'UnknownError'}).`,
          undefined,
          undefined,
          attempt
        );
      }
    }

    throw new AiProviderError(
      'gemini',
      this.model,
      'network-error',
      'Gemini generation failed after exhausting configured retry attempts.',
      undefined,
      undefined,
      this.maxAttempts
    );
  }

  private async waitForRetry(totalStarted: number, failedAttempt: number, reason: string): Promise<boolean> {
    const exponential = Math.min(
      this.retryMaxDelayMs,
      this.retryBaseDelayMs * (2 ** Math.max(0, failedAttempt - 1))
    );
    const jitter = this.retryJitterMs > 0 ? Math.floor(Math.random() * (this.retryJitterMs + 1)) : 0;
    const delayMs = exponential + jitter;
    const remaining = this.remainingBudget(totalStarted);

    // Keep a small execution margin for the next request/error handling.
    if (remaining <= delayMs + 250) return false;

    console.warn(
      `[ai:retry] provider=gemini model=${this.model} ` +
      `attempt=${failedAttempt}/${this.maxAttempts} reason=${reason} delayMs=${delayMs}`
    );

    await new Promise<void>(resolve => setTimeout(resolve, delayMs));
    return true;
  }

  private remainingBudget(totalStarted: number): number {
    return this.totalTimeoutMs - (Date.now() - totalStarted);
  }

  private isRetryableHttpStatus(status: number): boolean {
    return [408, 429, 500, 502, 503, 504].includes(status);
  }

  private extractText(body: GeminiGenerateContentResponse): string | undefined {
    for (const candidate of body.candidates ?? []) {
      for (const part of candidate.content?.parts ?? []) {
        if (typeof part.text === 'string' && part.text.trim()) return part.text.trim();
      }
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

  private configurationError(): string | undefined {
    if (!['low', 'medium', 'high'].includes(this.thinkingLevel)) {
      return `Unsupported GEMINI_THINKING_LEVEL='${this.thinkingLevel}'. Use low, medium or high.`;
    }
    if (!Number.isFinite(this.maxOutputTokens) || this.maxOutputTokens < 64) {
      return 'GEMINI_MAX_OUTPUT_TOKENS must be a number >= 64.';
    }
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      return 'AI_TIMEOUT_MS must be a positive number.';
    }
    if (!Number.isFinite(this.totalTimeoutMs) || this.totalTimeoutMs < this.timeoutMs) {
      return 'AI_TOTAL_TIMEOUT_MS must be a number greater than or equal to AI_TIMEOUT_MS.';
    }
    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts < 1 || this.maxAttempts > 5) {
      return 'AI_RETRY_MAX_ATTEMPTS must be an integer between 1 and 5.';
    }
    if (!Number.isFinite(this.retryBaseDelayMs) || this.retryBaseDelayMs < 0) {
      return 'AI_RETRY_BASE_DELAY_MS must be a non-negative number.';
    }
    if (!Number.isFinite(this.retryMaxDelayMs) || this.retryMaxDelayMs < this.retryBaseDelayMs) {
      return 'AI_RETRY_MAX_DELAY_MS must be greater than or equal to AI_RETRY_BASE_DELAY_MS.';
    }
    if (!Number.isFinite(this.retryJitterMs) || this.retryJitterMs < 0) {
      return 'AI_RETRY_JITTER_MS must be a non-negative number.';
    }
    return undefined;
  }
}
