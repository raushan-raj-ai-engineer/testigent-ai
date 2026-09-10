import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import type { ExecutionFacts } from '../../src/framework/analytics/report.types';
import { MailNotificationProvider } from '../../src/framework/notifications/mail.notification';

/**
 * Author: Raushan Raj
 * Business Use: Regression-validates the business email without sending to a real recipient.
 * How to use: npm run test:mail.
 * Benefit: Prevents broken subjects, missing metrics and incompatible dashboard attachments from reaching stakeholders.
 */
test('business email preview contains deterministic summary and V3-safe attachments', async () => {
  const reportDir = path.resolve('reports/framework-mail-test');
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, 'index.html'), '<html>interactive dashboard</html>');
  fs.writeFileSync(path.join(reportDir, 'business-tests.csv'), 'Scenario,Status\nCheckout,passed\n');
  fs.writeFileSync(path.join(reportDir, 'business-report.json'), '{}');

  const facts = sampleFacts();
  const previous = { ...process.env };
  Object.assign(process.env, {
    MAIL_MODE: 'preview',
    MAIL_FROM: 'automation@example.com',
    MAIL_TO: 'business@example.com',
    MAIL_SUBJECT_PREFIX: '[Framework Test]',
    MAIL_ATTACH_STATIC_REPORT: 'true',
    MAIL_ATTACH_CSV: 'true',
    MAIL_ATTACH_JSON: 'false',
    MAIL_PREVIEW_DIR: path.join(reportDir, 'preview')
  });

  try {
    const result = await new MailNotificationProvider().send({
      facts,
      reportDir,
      dashboardPath: path.join(reportDir, 'index.html'),
      publicReportUrl: 'https://reports.example.com/run-mail-test'
    });
    expect(result.mode).toBe('preview');
    expect(result.delivered).toBe(false);
    expect(result.previewPath).toBeTruthy();
    expect(path.basename(result.previewPath!)).toBe('latest-business-report.eml');
    expect(result.attachmentNames).toContain('automation-business-report-mail-test.html');
    expect(result.attachmentNames).toContain('business-tests-mail-test.csv');
    const raw = fs.readFileSync(result.previewPath!, 'utf8');
    expect(raw).toContain('[Framework Test] PASS - Order Portal - qa - 96.67%');
    expect(raw.toLowerCase()).toContain('automation release summary');
    expect(raw).toContain('96.67%');
    expect(raw).toContain('https://reports.example.com/run-mail-test');
    expect(raw).toContain('automation-business-report-mail-test.html');
    const topLevelEml = fs.readdirSync(path.dirname(result.previewPath!)).filter(name => name.endsWith('.eml'));
    expect(topLevelEml).toEqual(['latest-business-report.eml']);
  } finally {
    process.env = previous;
  }
});

function sampleFacts(): ExecutionFacts {
  return {
    runId: 'mail-test', environment: 'qa', application: 'Order Portal', generatedAt: new Date().toISOString(),
    total: 30, passed: 29, failed: 0, skipped: 1, executed: 29, executionRate: 96.67, executedPassRate: 100, passRate: 96.67,
    skipBreakdown: { count: 1, categories: [{ category: 'OTHER', label: 'Other / conditional skip', count: 1, testTitles: ['Not applicable scenario'], reasons: ['Not applicable in this configuration.'] }] },
    durationMs: 1000,
    healing: { count: 1, fallback: 0, cache: 0, ai: 1, affectedTests: 1, records: [] },
    flakiness: { flakyTests: 1, retryRecovered: 1, totalRetryAttempts: 1, tests: [] },
    failureClusters: [], failureCategoryCounts: {}, businessImpacts: [],
    layerCounts: { UI: 12, API: 10, DATABASE: 8, OTHER: 0 },
    testTypeCounts: { UI_ONLY: 8, API_ONLY: 6, DATABASE_ONLY: 4, UI_API: 4, UI_DATABASE: 2, API_DATABASE: 2, UI_API_DATABASE: 4, OTHER: 0 },
    qualityGate: { status: 'PASSED', passThreshold: 95, highImpactFailures: 0, reasons: [] },
    scope: { includedTests: 30, excludedInternalTests: 5, internalTestsIncluded: false, description: 'Business tests only' },
    results: [{
      testId: 'checkout', title: 'Customer places an order @critical @ui @api', project: 'chromium', status: 'passed', rawStatus: 'passed',
      durationMs: 1000, totalDurationMs: 1000, retriesUsed: 0, flaky: false, tags: ['@critical','@ui','@api'],
      steps: ['Customer logs in', 'Customer submits order'],
      stepDetails: [
        { title: 'Customer logs in', category: 'test.step', durationMs: 300, status: 'passed', children: [] },
        { title: 'Customer submits order', category: 'test.step', durationMs: 700, status: 'passed', children: [] }
      ],
      attachments: [], attempts: [{ retry: 0, status: 'passed', durationMs: 1000 }], sourceFile: 'tests/e2e/order.spec.ts', layers: ['UI','API'], testType: 'UI_API'
    }]
  };
}
