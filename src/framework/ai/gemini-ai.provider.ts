import type {
  AiHealingRequest,
  AiHealingResponse,
  AiProvider,
  AiProviderHealth
} from './ai.types';

import {
  buildHealingPrompt,
  buildSummaryPrompt,
  fetchWithTimeout,
  HEALING_OUTPUT_SCHEMA,
  parseHealingJson
} from './ai-provider.utils';

interface GeminiContent {
  type?: string;
  text?: string;
}

interface GeminiStep {
  type?: string;
  content?: GeminiContent[];
}

interface GeminiLegacyOutput {
  type?: string;
  text?: string;
}

interface GeminiInteractionResponse {
  model?: string;
  status?: string;
  output_text?: string;
  steps?: GeminiStep[];
  outputs?: GeminiLegacyOutput[];
}

export class GeminiProviderError extends Error {
  constructor(
    message: string,
    public readonly kind:
      | 'timeout'
      | 'http-error'
      | 'network-error'
      | 'invalid-response',
    public readonly provider = 'gemini',
    public readonly model?: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'GeminiProviderError';
  }
}

/**
 * Author: Raushan Raj
 * Business Use:
 * Governed Google Gemini provider for TestigentAI.
 *
 * Design:
 * - REST based; no Google SDK coupling.
 * - Configuration driven.
 * - Low-thinking locator recovery for predictable CI latency.
 * - Structured JSON responses.
 * - Safe diagnostics without leaking prompts, snapshots or API keys.
 */
export class GeminiAiProvider implements AiProvider {
  private readonly apiKey = process.env.GEMINI_API_KEY ?? '';
  private readonly model = process.env.GEMINI_MODEL ?? '';

  private readonly baseUrl = (
    process.env.GEMINI_BASE_URL ??
    'https://generativelanguage.googleapis.com/v1beta'
  ).replace(/\/$/, '');

  private readonly timeoutMs =
    Number(process.env.AI_TIMEOUT_MS ?? 30_000);

  private readonly thinkingLevel =
    process.env.GEMINI_THINKING_LEVEL ?? 'low';

  async proposeLocator(
    request: AiHealingRequest
  ): Promise<AiHealingResponse | undefined> {

    if (!this.apiKey || !this.model) {
      return undefined;
    }

    const prompt = buildHealingPrompt(request);
    const started = Date.now();

    const content = await this.interact(
      prompt.system,
      prompt.user,
      HEALING_OUTPUT_SCHEMA
    );

    return parseHealingJson(content, {
      provider: 'gemini',
      model: this.model,
      latencyMs: Date.now() - started
    });
  }

  async summarizeFailures(
    payload: unknown
  ): Promise<string | undefined> {

    if (!this.apiKey || !this.model) {
      return undefined;
    }

    const prompt = buildSummaryPrompt(payload);

    return this.interact(
      prompt.system,
      prompt.user
    );
  }

  async healthCheck(): Promise<AiProviderHealth> {

    if (!this.apiKey) {
      return {
        ok: false,
        provider: 'gemini',
        model: this.model,
        message: 'GEMINI_API_KEY is not configured.'
      };
    }

    if (!this.model) {
      return {
        ok: false,
        provider: 'gemini',
        message: 'GEMINI_MODEL is not configured.'
      };
    }

    const modelId = this.model.replace(/^models\//, '');

    try {

      const response = await fetchWithTimeout(
        `${this.baseUrl}/models/${encodeURIComponent(modelId)}`,
        {
          method: 'GET',
          headers: {
            'x-goog-api-key': this.apiKey
          }
        },
        this.timeoutMs
      );

      if (!response.ok) {
        return {
          ok: false,
          provider: 'gemini',
          model: this.model,
          message:
            `Gemini model validation failed with HTTP ` +
            `${response.status} for '${this.model}'.`
        };
      }

      return {
        ok: true,
        provider: 'gemini',
        model: this.model,
        message:
          `Gemini API key is accepted and model ` +
          `'${this.model}' is available.`
      };

    } catch (error) {

      return {
        ok: false,
        provider: 'gemini',
        model: this.model,
        message:
          `Gemini is not reachable: ` +
          `${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async interact(
    systemInstruction: string,
    input: string,
    schema?: object
  ): Promise<string | undefined> {

    const started = Date.now();

    try {

      const body = {
        model: this.model,

        input,

        system_instruction: systemInstruction,

        generation_config: {
          thinking_level: this.thinkingLevel
        },

        ...(schema
          ? {
              response_format: {
                type: 'text',
                mime_type: 'application/json',
                schema
              }
            }
          : {})
      };

      const response = await fetchWithTimeout(
        `${this.baseUrl}/interactions`,
        {
          method: 'POST',

          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': this.apiKey
          },

          body: JSON.stringify(body)
        },
        this.timeoutMs
      );

      if (!response.ok) {

        const safeBody = await this.safeErrorBody(response);

        throw new GeminiProviderError(
          `Gemini request failed with HTTP ${response.status}` +
            (safeBody ? `: ${safeBody}` : ''),
          'http-error',
          'gemini',
          this.model,
          response.status
        );
      }

      const result =
        (await response.json()) as GeminiInteractionResponse;

      // Current convenience representation.
      if (
        typeof result.output_text === 'string' &&
        result.output_text.trim()
      ) {
        return result.output_text.trim();
      }

      // Current Interactions API response representation.
      for (const step of result.steps ?? []) {

        if (step.type !== 'model_output') {
          continue;
        }

        const text = step.content?.find(
          item =>
            item.type === 'text' &&
            typeof item.text === 'string' &&
            item.text.trim()
        )?.text;

        if (text?.trim()) {
          return text.trim();
        }
      }

      // Compatibility with older Interactions response shape.
      for (const output of result.outputs ?? []) {

        if (
          output.type === 'text' &&
          typeof output.text === 'string' &&
          output.text.trim()
        ) {
          return output.text.trim();
        }
      }

      throw new GeminiProviderError(
        `Gemini returned no usable model text. ` +
          `status=${result.status ?? 'unknown'} ` +
          `latencyMs=${Date.now() - started}`,
        'invalid-response',
        'gemini',
        this.model
      );

    } catch (error) {

      if (error instanceof GeminiProviderError) {
        throw error;
      }

      if (
        error instanceof Error &&
        (
          error.name === 'AbortError' ||
          /abort|timeout/i.test(error.message)
        )
      ) {
        throw new GeminiProviderError(
          `Gemini request exceeded AI_TIMEOUT_MS=${this.timeoutMs}`,
          'timeout',
          'gemini',
          this.model
        );
      }

      throw new GeminiProviderError(
        `Gemini network request failed: ` +
          `${error instanceof Error ? error.message : String(error)}`,
        'network-error',
        'gemini',
        this.model
      );
    }
  }

  private async safeErrorBody(
    response: Response
  ): Promise<string | undefined> {

    try {
      const raw = (await response.text())
        .replace(/\s+/g, ' ')
        .trim();

      if (!raw) return undefined;

      // Never dump large provider responses into CI logs.
      return raw.slice(0, 500);

    } catch {
      return undefined;
    }
  }
}
