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
