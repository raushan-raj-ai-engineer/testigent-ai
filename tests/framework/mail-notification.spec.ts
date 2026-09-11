import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { buildExecutionFacts } from '../../src/framework/analytics/execution-facts';
import type { BusinessTestResult, HealingSummary } from '../../src/framework/analytics/report.types';
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
    expect(raw).toContain('[Framework Test] PASS - Order Portal - qa - 100% quality pass');
    expect(raw.toLowerCase()).toContain('automation release summary');
    expect(raw).toContain('Execution coverage: 100%');
    expect(raw).toContain('https://reports.example.com/run-mail-test');
    expect(raw).toContain('automation-business-report-mail-test.html');
    const topLevelEml = fs.readdirSync(path.dirname(result.previewPath!)).filter(name => name.endsWith('.eml'));
    expect(topLevelEml).toEqual(['latest-business-report.eml']);
  } finally {
    process.env = previous;
  }
});

function sampleFacts() {
  const results: BusinessTestResult[] = Array.from({ length: 29 }, (_, index): BusinessTestResult => ({
    testId: `checkout-${index + 1}`,
    title: index === 0 ? 'Customer places an order @critical @ui @api' : `Order scenario ${index + 1} @ui`,
    project: 'chromium',
    status: 'passed',
    rawStatus: 'passed',
    durationMs: index === 0 ? 1000 : 0,
    totalDurationMs: index === 0 ? 1000 : 0,
    retriesUsed: 0,
    flaky: false,
    tags: index === 0 ? ['@critical', '@ui', '@api'] : ['@ui'],
    steps: index === 0 ? ['Customer logs in', 'Customer submits order'] : [],
    stepDetails: index === 0 ? [
      { title: 'Customer logs in', category: 'test.step', durationMs: 300, status: 'passed', children: [] },
      { title: 'Customer submits order', category: 'test.step', durationMs: 700, status: 'passed', children: [] }
    ] : [],
    attachments: [],
    attempts: [{ retry: 0, status: 'passed', durationMs: index === 0 ? 1000 : 0 }],
    sourceFile: index === 0 ? 'tests/e2e/order.spec.ts' : `tests/e2e/order-${index + 1}.spec.ts`,
    layers: index === 0 ? ['UI', 'API'] : ['UI'],
    testType: index === 0 ? 'UI_API' : 'UI_ONLY'
  }));

  results.push({
    testId: 'not-applicable',
    title: 'Optional database scenario',
    project: 'chromium',
    status: 'skipped',
    rawStatus: 'skipped',
    durationMs: 0,
    totalDurationMs: 0,
    retriesUsed: 0,
    flaky: false,
    tags: [],
    steps: [],
    skipReason: 'Database capability is optional and disabled for this project/environment.',
    skipCategory: 'DATABASE_NOT_CONFIGURED',
    attempts: [{ retry: 0, status: 'skipped', durationMs: 0 }]
  });

  return buildExecutionFacts({
    runId: 'mail-test',
    environment: 'qa',
    application: 'Order Portal',
    generatedAt: new Date().toISOString(),
    results,
    healing: noHealing(),
    scope: { excludedInternalTests: 5, internalTestsIncluded: false }
  });
}

function noHealing(): HealingSummary {
  return {
    count: 0,
    fallback: 0,
    cache: 0,
    ai: 0,
    affectedTests: 0,
    records: [],
    attempts: [],
    attemptCount: 0,
    rejected: 0,
    suggested: 0,
    unverified: 0
  };
}

