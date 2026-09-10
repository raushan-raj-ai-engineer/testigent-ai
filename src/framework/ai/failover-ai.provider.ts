import type { AiHealingRequest, AiHealingResponse, AiProvider, AiProviderHealth } from './ai.types';

/**
 * Author: Raushan Raj
 * Business Use: Resilient provider failover for governed AI capabilities.
 * How to use: Construct with an ordered list of configured providers. The first healthy/result-producing provider wins.
 * Benefit: The caller-defined provider order can transparently fall back to the next approved provider on provider/runtime failure.
 * Safety: A concrete AI result is returned to the caller for deterministic validation. The chain does not "vote" across
 * providers when a provider returns an unsafe locator; only exceptions/no-result conditions trigger provider failover.
 */
export class FailoverAiProvider implements AiProvider {
  constructor(private readonly providers: Array<{ name: string; provider: AiProvider }>) {}

  async proposeLocator(request: AiHealingRequest): Promise<AiHealingResponse | undefined> {
    for (const { provider } of this.providers) {
      try {
        const result = await provider.proposeLocator(request);
        if (result) return result;
      } catch {
        // Provider/runtime failure is recoverable at this layer; try the next approved provider.
      }
    }
    return undefined;
  }

  async summarizeFailures(payload: unknown): Promise<string | undefined> {
    for (const { provider } of this.providers) {
      if (!provider.summarizeFailures) continue;
      try {
        const result = await provider.summarizeFailures(payload);
        if (result) return result;
      } catch {
        // Continue only for provider/runtime failures or no-result conditions.
      }
    }
    return undefined;
  }

  async healthCheck(): Promise<AiProviderHealth> {
    const details: string[] = [];
    for (const { name, provider } of this.providers) {
      if (!provider.healthCheck) { details.push(`${name}: configured`); continue; }
      try {
        const health = await provider.healthCheck();
        details.push(`${name}: ${health.ok ? 'OK' : 'NOT READY'}`);
        if (health.ok) return { ok: true, provider: 'failover-chain', model: health.model, message: `Provider chain ready. ${details.join(', ')}` };
      } catch (error) {
        details.push(`${name}: ERROR (${error instanceof Error ? error.message : String(error)})`);
      }
    }
    return { ok: false, provider: 'failover-chain', message: `No provider in the chain is ready. ${details.join(', ')}` };
  }
}
