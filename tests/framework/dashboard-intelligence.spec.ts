import path from 'node:path';
import { expect, test } from '@playwright/test';
import { buildExecutionFacts } from '../../src/framework/analytics/execution-facts';
import type { BusinessTestResult, HealingSummary } from '../../src/framework/analytics/report.types';
import { classifyTestLayers } from '../../src/framework/analytics/test-layer.classifier';
import { renderBusinessHtml } from '../../src/framework/reporting/business-html.renderer';
import { shouldIncludeInBusinessReport } from '../../src/framework/reporting/business-report-scope';

/**
 * Author: Raushan Raj
 * Business Use: Browser-level regression protection for dashboard totals, charts, filters and report scope.
 * How to use: `npm run test:dashboard`; this test renders the actual generated dashboard in Chromium and interacts with it.
 * Benefit: Prevents static HTML checks from falsely passing when client-side filters/charts are broken.
 */
test.describe('Business dashboard runtime', () => {
  test('keeps framework checks out of business scope', () => {
    expect(shouldIncludeInBusinessReport([], '/repo/tests/framework/dashboard-intelligence.spec.ts')).toBe(false);
    expect(shouldIncludeInBusinessReport(['@framework'], '/repo/projects/demo/tests/meta.spec.ts')).toBe(false);
    expect(shouldIncludeInBusinessReport(['@ui'], '/repo/tests/ui/login.spec.ts')).toBe(true);
  });

  test('classifies UI, API, DB and cross-layer tests', () => {
    expect(classifyTestLayers(['@ui'], '/tests/ui/login.spec.ts').testType).toBe('UI_ONLY');
    expect(classifyTestLayers(['@api'], '/tests/api/user.spec.ts').testType).toBe('API_ONLY');
    expect(classifyTestLayers(['@db'], '/tests/database/order.spec.ts').testType).toBe('DATABASE_ONLY');
    expect(classifyTestLayers(['@ui', '@api', '@db'], '/tests/e2e/order.spec.ts').testType).toBe('UI_API_DATABASE');
  });

  test('renders graphs and applies status, layer, tag and search filters in a real browser', async ({ page }) => {
    const facts = buildExecutionFacts({
      runId: 'dashboard-runtime',
      environment: 'qa',
      application: 'demo',
      healing: noHealing(),
      aiUsage: {
        calls: 1, healingCalls: 1, reportingCalls: 0, successfulCalls: 1,
        noResultCalls: 0, errorCalls: 0, budgetBlockedCalls: 0, averageLatencyMs: 321,
        providers: [{ provider: 'gemini', calls: 1, models: ['gemini-contract-model'] }],
        records: [{ runId: 'dashboard-runtime', testId: '1', timestamp: new Date().toISOString(), purpose: 'healing', status: 'success', provider: 'gemini', model: 'gemini-contract-model', latencyMs: 321 }]
      },
      scope: { excludedInternalTests: 8, internalTestsIncluded: false },
      results: [
        sample('1', 'Checkout works @ui @api @critical', 'passed', ['@ui', '@api', '@critical'], '/tests/e2e/checkout.spec.ts'),
        sample('2', 'Customer API rejects invalid request @api', 'failed', ['@api'], '/tests/api/customer.spec.ts', 'PRODUCT_DEFECT'),
        sample('3', 'Order record persists @db', 'skipped', ['@db'], '/tests/database/order.spec.ts')
      ]
    });
    const html = renderBusinessHtml(facts, { history: [
      { runId: 'r1', generatedAt: '2026-09-01T00:00:00Z', environment: 'qa', application: 'demo', total: 3, passed: 2, failed: 1, passRate: 66.67, flaky: 0, healed: 0 },
      { runId: 'r2', generatedAt: '2026-09-02T00:00:00Z', environment: 'qa', application: 'demo', total: 3, passed: 1, failed: 1, passRate: 33.33, flaky: 0, healed: 0 }
    ] });

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    expect(html).toContain('AI runtime audit');
    expect(html).toContain('gemini-contract-model');
    // page.setContent() has an about:blank base URL, so the dashboard's relative external
    // asset cannot resolve as it does in the real HTTP/file bundle. Inject the same production
    // client asset explicitly; the HTTP bundle behavior is covered separately by dashboard-interactive.spec.ts.
    await page.addScriptTag({ path: path.resolve('src/framework/reporting/assets/dashboard.js') });
    await expect(page.locator('#dashboardJsStatus')).toHaveText('Interactive controls ready');
    await expect(page.locator('#statusDonut .status-donut-svg')).toBeVisible();
    await expect(page.locator('#statusDonut .donut-segment')).toHaveCount(3);
    await expect(page.locator('#donutPassRate')).toHaveText('50%');
    await expect(page.locator('#layerBars .bar-row')).toHaveCount(4);
    await expect(page.locator('#trendChart')).toBeVisible();
    await expect(page.locator('.test-row:not([hidden])')).toHaveCount(3);
    await expect(page.locator('#showing')).toContainText('3 of 3');

    await page.locator('#statusFilter').selectOption('failed');
    await expect(page.locator('.test-row:not([hidden])')).toHaveCount(1);
    await expect(page.locator('#showing')).toContainText('1 of 3');
    await expect(page.locator('#filteredFail')).toHaveText('Fail 1');

    await page.locator('#resetBtn').click();
    await page.locator('#layerFilter').selectOption('api');
    await expect(page.locator('.test-row:not([hidden])')).toHaveCount(2);

    await page.locator('#resetBtn').click();
    await page.locator('#tagFilter').selectOption('@critical');
    await expect(page.locator('.test-row:not([hidden])')).toHaveCount(1);
    await expect(page.locator('.test-row:not([hidden]) .scenario-title')).toContainText('Checkout works');

    await page.locator('#resetBtn').click();
    await page.locator('#searchFilter').fill('order record');
    await expect(page.locator('.test-row:not([hidden])')).toHaveCount(1);
    await expect(page.locator('.test-row:not([hidden]) .scenario-title')).toContainText('Order record persists');
  });
});

function sample(
  testId: string,
  title: string,
  status: 'passed' | 'failed' | 'skipped',
  tags: string[],
  sourceFile: string,
  failureCategory?: BusinessTestResult['failureCategory']
): BusinessTestResult {
  const classification = classifyTestLayers(tags, sourceFile);
  return {
    testId,
    title,
    project: 'chromium',
    status,
    rawStatus: status,
    durationMs: 500,
    totalDurationMs: 500,
    retriesUsed: 0,
    flaky: false,
    tags,
    steps: ['Business action'],
    error: status === 'failed' ? 'Synthetic dashboard regression failure' : undefined,
    failureCategory,
    attempts: [{ retry: 0, status, durationMs: 500, failureCategory }],
    sourceFile,
    ...classification
  };
}

function noHealing(): HealingSummary {
  return { count: 0, fallback: 0, cache: 0, ai: 0, affectedTests: 0, records: [], attempts: [], attemptCount: 0, rejected: 0, suggested: 0, unverified: 0 };
}
