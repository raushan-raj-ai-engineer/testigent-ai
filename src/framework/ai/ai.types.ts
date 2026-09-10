/**
 * Author: Raushan Raj
 * Business Use: Vendor-neutral contracts for governed AI capabilities across the automation platform.
 * How to use: Framework AI providers implement AiProvider; tests/workflows use AiGateway and never import a vendor directly.
 * Benefit: Ollama/OpenAI/Anthropic/Azure/Gemini/compatible providers can be explicitly selected or reordered without rewriting Playwright tests.
 */
import type { LocatorDescriptor } from '../healing/healing.types';

export interface AiHealingRequest {
  planId: string;
  businessName: string;
  accessibilitySnapshot: string;
  allowedDescriptorTypes: LocatorDescriptor['type'][];
}

export interface AiResponseMetadata {
  provider?: string;
  model?: string;
  latencyMs?: number;
}

export interface AiHealingResponse extends AiResponseMetadata {
  descriptor: LocatorDescriptor;
  confidence: number;
  reason: string;
}

export interface AiProviderHealth {
  ok: boolean;
  provider: string;
  model?: string;
  message: string;
}

export interface AiProvider {
  proposeLocator(request: AiHealingRequest): Promise<AiHealingResponse | undefined>;
  summarizeFailures?(payload: unknown): Promise<string | undefined>;
  healthCheck?(): Promise<AiProviderHealth>;
}
