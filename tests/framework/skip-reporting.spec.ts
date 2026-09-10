import { expect, test } from '@playwright/test';
import { buildExecutionFacts } from '../../src/framework/analytics/execution-facts';
import type { BusinessTestResult, HealingSummary } from '../../src/framework/analytics/report.types';
import { classifySkipReason } from '../../src/framework/reporting/skip-reason.classifier';
import { renderBusinessHtml } from '../../src/framework/reporting/business-html.renderer';

test.describe('Skip reporting contract', () => {
  test('categorizes intentional skips and exposes them in execution facts', () => {
    expect(classifySkipReason('Configure a test database before running DB tests.').category).toBe('DATABASE_NOT_CONFIGURED');
    expect(classifySkipReason('REVIEW_REQUIRED: generated from requirement; approve mappings before execution.', { annotationType: 'fixme' }).category).toBe('HUMAN_REVIEW_PENDING');
    expect(classifySkipReason('Run through npm run test:healing only.').category).toBe('OPTIONAL_DEMO_DISABLED');

    const facts = buildExecutionFacts({
      runId: 'skip-contract', environment: 'qa', application: 'demo', healing: noHealing(),
      results: [
        result('a', 'API works', 'passed'),
        result('b', 'DB check', 'skipped', 'Configure a test database before running DB tests.', 'DATABASE_NOT_CONFIGURED'),
        result('c', 'Generated payment', 'skipped', 'REVIEW_REQUIRED: approve mappings before execution.', 'HUMAN_REVIEW_PENDING')
      ]
    });

    expect(facts.total).toBe(3);
    expect(facts.executed).toBe(1);
    expect(facts.executionRate).toBe(33.33);
    expect(facts.executedPassRate).toBe(100);
    expect(facts.qualityGate.status).toBe('PASSED');
    expect(facts.skipBreakdown.count).toBe(2);
    expect(facts.skipBreakdown.categories.map(item => item.category)).toEqual([
      'DATABASE_NOT_CONFIGURED',
      'HUMAN_REVIEW_PENDING'
    ]);

    const html = renderBusinessHtml(facts);
    expect(html).toContain('Skip Breakdown');
    expect(html).toContain('Database not configured');
    expect(html).toContain('Human review pending');
    expect(html).toContain('Executed pass rate');
  });
});

function result(
  testId: string,
  title: string,
  status: 'passed' | 'skipped',
  skipReason?: string,
  skipCategory?: BusinessTestResult['skipCategory']
): BusinessTestResult {
  return {
    testId, title, project: 'chromium', status, rawStatus: status,
    durationMs: 100, totalDurationMs: 100, retriesUsed: 0, flaky: false,
    tags: [], steps: [], skipReason, skipCategory,
    attempts: [{ retry: 0, status, durationMs: 100 }]
  };
}

function noHealing(): HealingSummary {
  return { count: 0, fallback: 0, cache: 0, ai: 0, affectedTests: 0, records: [] };
}
