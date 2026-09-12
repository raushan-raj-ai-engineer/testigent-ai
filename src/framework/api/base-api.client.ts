import type { APIRequestContext, APIResponse, TestInfo } from '@playwright/test';
import type { EnterpriseLogger } from '../logging/enterprise.logger';
import { redact, sanitizeAndTruncate, sanitizeUrl } from '../logging/redactor';

type ApiLogger = Pick<EnterpriseLogger, 'info'>;

export interface ApiRequestOptions {
  data?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
}

/**
 * Author: Raushan Raj
 * Business Use: Shared HTTP policy for all domain APIs (logging, correlation, evidence, error handling).
 * How to use: Domain service classes call get/post/put/delete instead of using request directly.
 * Benefit: Consistent API standards across products and centralized security/observability.
 */
export class BaseApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly baseUrl: string,
    private readonly logger: ApiLogger,
    private readonly testInfo?: TestInfo
  ) {}

  get(path: string, options?: ApiRequestOptions): Promise<APIResponse> { return this.send('GET', path, options); }
  post(path: string, options?: ApiRequestOptions): Promise<APIResponse> { return this.send('POST', path, options); }
  put(path: string, options?: ApiRequestOptions): Promise<APIResponse> { return this.send('PUT', path, options); }
  patch(path: string, options?: ApiRequestOptions): Promise<APIResponse> { return this.send('PATCH', path, options); }
  delete(path: string, options?: ApiRequestOptions): Promise<APIResponse> { return this.send('DELETE', path, options); }

  private async send(method: string, path: string, options: ApiRequestOptions = {}): Promise<APIResponse> {
    const correlationId = `pw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const url = new URL(path, this.baseUrl).toString();
    const started = Date.now();
    const response = await this.request.fetch(url, {
      method,
      data: options.data,
      params: options.params,
      headers: { 'x-test-correlation-id': correlationId, ...options.headers }
    });
    const body = await response.text();

    // Evidence is intentionally allowlisted. Do not persist the Playwright request/response objects themselves.
    const evidence = {
      method,
      url: sanitizeUrl(url),
      status: response.status(),
      durationMs: Date.now() - started,
      correlationId,
      request: redact({
        headers: options.headers ?? {},
        params: options.params ?? {},
        data: options.data
      }),
      responseBody: sanitizeAndTruncate(body, 8_000)
    };
    this.logger.info('API_CALL', evidence);
    if (this.testInfo) {
      await this.testInfo.attach(`api-${method}-${correlationId}.json`, {
        body: JSON.stringify(evidence, null, 2),
        contentType: 'application/json'
      });
    }
    return response;
  }
}
