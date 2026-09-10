import type { AiHealingRequest, AiHealingResponse, AiProvider } from './ai.types';

/**
 * Author: Raushan Raj
 * Business Use: Vendor-neutral HTTP adapter for an organization-approved AI service.
 * How to use: Configure AI_ENDPOINT, AI_API_KEY and AI_MODEL. Adapt the HTTP contract to your internal AI gateway.
 * Benefit: Tests are not coupled to one AI vendor; governance/model routing stays centralized.
 */
export class HttpAiProvider implements AiProvider {
  async proposeLocator(request: AiHealingRequest): Promise<AiHealingResponse | undefined> {
    return this.post<AiHealingResponse>('locator-healing', request);
  }

  async summarizeFailures(payload: unknown): Promise<string | undefined> {
    const response = await this.post<{ summary?: string }>('failure-summary', payload);
    return response?.summary;
  }

  private async post<T>(task: string, payload: unknown): Promise<T | undefined> {
    const endpoint = process.env.AI_ENDPOINT;
    if (!endpoint) return undefined;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.AI_API_KEY ? { authorization: `Bearer ${process.env.AI_API_KEY}` } : {})
      },
      body: JSON.stringify({ model: process.env.AI_MODEL, task, payload })
    });
    if (!response.ok) return undefined;
    return (await response.json()) as T;
  }
}
