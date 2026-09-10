import type { Page, TestInfo } from '@playwright/test';
import type { EnterpriseLogger } from './enterprise.logger';
import { redact } from './redactor';

/**
 * Author: Raushan Raj
 * Business Use: Captures browser console errors, page errors and failed/4xx/5xx network calls with the test correlation context.
 * How to use: Enterprise fixture starts it automatically for tests that request the `app` fixture.
 * Benefit: Faster root-cause analysis without manually reproducing browser failures.
 */
export class BrowserObservability {
  private readonly evidence: unknown[] = [];
  constructor(private readonly page: Page, private readonly logger: EnterpriseLogger, private readonly testInfo: TestInfo) {}

  start(): void {
    this.page.on('console', message => {
      const verbose = process.env.VERBOSE_BROWSER_LOGS === 'true';
      if (verbose || ['warning', 'error'].includes(message.type())) {
        const item = { kind: 'console', type: message.type(), text: message.text(), url: this.page.url() };
        this.evidence.push(item); this.logger.warn('BROWSER_CONSOLE', item);
      }
    });
    this.page.on('pageerror', error => {
      const item = { kind: 'pageerror', message: error.message, url: this.page.url() };
      this.evidence.push(item); this.logger.error('BROWSER_PAGE_ERROR', item);
    });
    this.page.on('requestfailed', request => {
      const item = { kind: 'requestfailed', method: request.method(), url: request.url(), failure: request.failure()?.errorText };
      this.evidence.push(item); this.logger.error('NETWORK_REQUEST_FAILED', item);
    });
    this.page.on('response', response => {
      const verbose = process.env.VERBOSE_BROWSER_LOGS === 'true';
      if (verbose || response.status() >= 400) {
        const item = { kind: response.status() >= 400 ? 'http-error' : 'http-response', status: response.status(), method: response.request().method(), url: response.url() };
        this.evidence.push(item);
        if (response.status() >= 400) this.logger.warn('NETWORK_HTTP_ERROR', item); else this.logger.debug('NETWORK_RESPONSE', item);
      }
    });
  }

  async attachIfUseful(): Promise<void> {
    if (!this.evidence.length) return;
    if (this.testInfo.status === 'passed' && process.env.VERBOSE_BROWSER_LOGS !== 'true') return;
    await this.testInfo.attach('browser-observability.json', {
      body: JSON.stringify(redact(this.evidence), null, 2), contentType: 'application/json'
    });
  }
}
