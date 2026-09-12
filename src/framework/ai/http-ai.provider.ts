import type { AiHealingRequest, AiHealingResponse, AiProvider, AiProviderHealth } from './ai.types';
import { AiProviderError } from './ai-provider.error';
import { fetchWithTimeout, parseHealingJson, resolveAiTimeoutMs } from './ai-provider.utils';
import { assertAiDestinationAllowed } from './ai-egress.policy';

/**
 * Author: Raushan Raj
 * Business Use: Vendor-neutral HTTP adapter for an organization-approved AI service.
 * How to use: Configure AI_ENDPOINT, AI_API_KEY and AI_MODEL. The endpoint must pass the shared origin/transport policy.
 * Benefit: Tests are not coupled to one AI vendor; governance/model routing stays centralized.
 *
 * Reliability policy: one bounded network attempt per gateway invocation. This adapter does not hide retries inside
 * a single budgeted AI call; organizations that need retry/failover should use provider failover or the upstream gateway.
 */
/** Vendor-neutral, bounded, schema-validating HTTP AI adapter behind the shared AiProvider contract. */
export class HttpAiProvider implements AiProvider {
  private readonly endpoint = process.env.AI_ENDPOINT ?? '';
  private readonly model = process.env.AI_MODEL ?? '';
  private readonly timeoutMs = resolveAiTimeoutMs();

  async proposeLocator(request: AiHealingRequest): Promise<AiHealingResponse | undefined> {
    const started = Date.now();
    const raw = await this.post('locator-healing', request);
    const parsed = parseHealingJson(JSON.stringify(raw), {
      provider: 'http',
      model: this.model || undefined,
      latencyMs: Date.now() - started
    });
    if (!parsed) {
      throw new AiProviderError('http', this.model || undefined, 'invalid-response', 'HTTP AI provider returned a locator response that failed schema validation.', undefined, undefined, 1);
    }
    return parsed;
  }

  async summarizeFailures(payload: unknown): Promise<string | undefined> {
    const raw = await this.post('failure-summary', payload);
    if (!raw || typeof raw !== 'object' || typeof (raw as { summary?: unknown }).summary !== 'string') {
      throw new AiProviderError('http', this.model || undefined, 'invalid-response', 'HTTP AI provider returned a failure summary that failed schema validation.', undefined, undefined, 1);
    }
    const summary = (raw as { summary: string }).summary.trim();
    if (!summary) throw new AiProviderError('http', this.model || undefined, 'invalid-response', 'HTTP AI provider returned an empty failure summary.', undefined, undefined, 1);
    return summary;
  }

  async healthCheck(): Promise<AiProviderHealth> {
    if (!this.endpoint) return { ok: false, provider: 'http', model: this.model || undefined, message: 'AI_ENDPOINT is not configured.' };
    try {
      const decision = assertAiDestinationAllowed(this.endpoint);
      return { ok: true, provider: 'http', model: this.model || undefined, message: `HTTP AI endpoint approved at ${decision.origin} (${decision.approvedBy}).` };
    } catch (error) {
      return { ok: false, provider: 'http', model: this.model || undefined, message: error instanceof Error ? error.message : String(error) };
    }
  }

  private async post(task: string, payload: unknown): Promise<unknown> {
    if (!this.endpoint) throw new AiProviderError('http', this.model || undefined, 'configuration', 'AI_ENDPOINT is not configured.', undefined, undefined, 0);
    try {
      const response = await fetchWithTimeout(this.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(process.env.AI_API_KEY ? { authorization: `Bearer ${process.env.AI_API_KEY}` } : {})
        },
        body: JSON.stringify({ model: this.model || undefined, task, payload })
      }, this.timeoutMs);

      if (!response.ok) {
        throw new AiProviderError(
          'http',
          this.model || undefined,
          'http-error',
          `HTTP AI provider returned HTTP ${response.status}.`,
          response.status,
          undefined,
          1
        );
      }

      try { return await response.json(); }
      catch {
        throw new AiProviderError('http', this.model || undefined, 'invalid-response', 'HTTP AI provider did not return valid JSON.', response.status, undefined, 1);
      }
    } catch (error) {
      if (error instanceof AiProviderError) throw error;
      const timeout = error instanceof Error && (error.name === 'AbortError' || /abort|timeout/i.test(error.message));
      throw new AiProviderError(
        'http',
        this.model || undefined,
        timeout ? 'timeout' : 'network-error',
        timeout ? `HTTP AI provider exceeded timeout ${this.timeoutMs}ms.` : `HTTP AI provider request failed (${error instanceof Error ? error.name : 'UnknownError'}).`,
        undefined,
        undefined,
        1
      );
    }
  }
}
