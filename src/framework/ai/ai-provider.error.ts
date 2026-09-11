/**
 * Vendor-neutral provider failure metadata.
 *
 * Provider adapters may throw this error so the gateway can preserve safe
 * operational metadata without importing any vendor-specific implementation.
 */
export type AiProviderErrorKind =
  | 'configuration'
  | 'timeout'
  | 'http-error'
  | 'network-error'
  | 'invalid-response';

/**
 * Reusable framework class `AiProviderError`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export class AiProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly model: string | undefined,
    public readonly kind: AiProviderErrorKind,
    message: string,
    public readonly statusCode?: number,
    public readonly providerCode?: string,
    public readonly attempts?: number
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}
