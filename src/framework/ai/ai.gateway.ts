import type { AiHealingRequest, AiHealingResponse, AiProvider } from './ai.types';
import { redact } from '../logging/redactor';
import { AiAudit } from './ai.audit';
import { AiProviderError } from './ai-provider.error';

export interface AiUsage {
  healingCalls: number;
  reportingCalls: number;
  totalCalls: number;
  healingLimit: number;
  reportingLimit: number;
}

/**
 * Author: Raushan Raj
 * Business Use: Security, budget and provider boundary for every AI capability in the framework.
 * How to use: Build through createAiGateway(); healing calls proposeLocator(), reporting calls summarizeFailures().
 * Benefit: Separate budgets prevent reporting from consuming healing capacity and stop runaway LLM usage in large suites.
 */
export class AiGateway {
  private healingCalls = 0;
  private reportingCalls = 0;
  private readonly healingLimit = Number(process.env.AI_MAX_HEALING_CALLS_PER_TEST ?? process.env.AI_MAX_CALLS_PER_TEST ?? 2);
  private readonly reportingLimit = Number(process.env.AI_MAX_REPORT_CALLS_PER_RUN ?? 1);

  private readonly audit: AiAudit;

  constructor(private readonly provider: AiProvider, testId?: string) {
    this.audit = new AiAudit(testId);
  }

  async proposeLocator(request: AiHealingRequest): Promise<AiHealingResponse | undefined> {
    if (process.env.AI_ENABLED !== 'true' || process.env.HEALING_AI_ENABLED !== 'true') return undefined;

    if (this.healingCalls >= this.healingLimit) {
      this.audit.record({
        purpose: 'healing',
        status: 'budget-blocked',
        message: `AI healing call limit ${this.healingLimit} reached.`
      });
      return undefined;
    }

    this.healingCalls += 1;
    const started = Date.now();

    try {
      const result = await this.provider.proposeLocator(redact(request));
      this.audit.record({
        purpose: 'healing',
        status: result ? 'success' : 'no-result',
        provider: result?.provider,
        model: result?.model,
        latencyMs: result?.latencyMs ?? Date.now() - started
      });
      return result;
    } catch (error) {
      if (error instanceof AiProviderError) {
        const message = [
          error.kind,
          error.statusCode === undefined ? undefined : `HTTP_${error.statusCode}`,
          error.providerCode
        ].filter(Boolean).join(':') + (error.attempts ? `:attempts=${error.attempts}` : '');

        this.audit.record({
          purpose: 'healing',
          status: 'error',
          provider: error.provider,
          model: error.model,
          latencyMs: Date.now() - started,
          message
        });
      } else {
        this.audit.record({
          purpose: 'healing',
          status: 'error',
          latencyMs: Date.now() - started,
          message: error instanceof Error ? error.name : 'ProviderError'
        });
      }
      throw error;
    }
  }

  async summarizeFailures(payload: unknown): Promise<string | undefined> {
    if (process.env.AI_ENABLED !== 'true' || !this.provider.summarizeFailures) return undefined;

    if (this.reportingCalls >= this.reportingLimit) {
      this.audit.record({
        purpose: 'reporting',
        status: 'budget-blocked',
        message: `AI reporting call limit ${this.reportingLimit} reached.`
      });
      return undefined;
    }

    this.reportingCalls += 1;
    const started = Date.now();

    try {
      const result = await this.provider.summarizeFailures(redact(payload));
      this.audit.record({
        purpose: 'reporting',
        status: result ? 'success' : 'no-result',
        latencyMs: Date.now() - started
      });
      return result;
    } catch (error) {
      if (error instanceof AiProviderError) {
        this.audit.record({
          purpose: 'reporting',
          status: 'error',
          provider: error.provider,
          model: error.model,
          latencyMs: Date.now() - started,
          message: error.kind + (error.attempts ? `:attempts=${error.attempts}` : '')
        });
      } else {
        this.audit.record({
          purpose: 'reporting',
          status: 'error',
          latencyMs: Date.now() - started,
          message: error instanceof Error ? error.name : 'ProviderError'
        });
      }
      throw error;
    }
  }

  getUsage(): AiUsage {
    return {
      healingCalls: this.healingCalls,
      reportingCalls: this.reportingCalls,
      totalCalls: this.healingCalls + this.reportingCalls,
      healingLimit: this.healingLimit,
      reportingLimit: this.reportingLimit
    };
  }
}
