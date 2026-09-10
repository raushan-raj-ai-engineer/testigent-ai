import { expect, test } from '@playwright/test';
import { buildExecutionFacts } from '../../src/framework/analytics/execution-facts';
import type { BusinessTestResult, HealingSummary } from '../../src/framework/analytics/report.types';

/**
 * Author: Raushan Raj
 * Business Use: Regression test for deterministic failure clustering and retry/flaky analytics.
 * How to use: npm run test:intelligence.
 * Benefit: Protects business reporting logic from regressions without requiring a real application or LLM.
 */
test.describe('Reporting intelligence', () => {
  test('clusters equivalent failures with volatile request ids', () => {
    const facts = buildExecutionFacts({
      runId: 'unit', environment: 'qa', application: 'demo', healing: noHealing(),
      results: [
        result('a', 'Login A', 'failed', 'Authentication service returned HTTP 503 request 83471', 'DEPENDENCY'),
        result('b', 'Login B', 'failed', 'Authentication service returned HTTP 503 request 91222', 'DEPENDENCY')
      ]
    });
    expect(facts.failureClusters).toHaveLength(1);
    expect(facts.failureClusters[0].affectedTests).toBe(2);
  });

  test('marks a retry-recovered test as flaky', () => {
    const flaky = result('c', 'Search', 'passed');
    flaky.attempts = [
      { retry: 0, status: 'failed', durationMs: 100, error: 'temporary timeout', failureCategory: 'TEST_DEFECT' },
      { retry: 1, status: 'passed', durationMs: 80 }
    ];
    flaky.retriesUsed = 1;
    flaky.flaky = true;
    flaky.totalDurationMs = 180;
    const facts = buildExecutionFacts({ runId: 'unit', environment: 'qa', application: 'demo', healing: noHealing(), results: [flaky] });
    expect(facts.flakiness.flakyTests).toBe(1);
    expect(facts.flakiness.retryRecovered).toBe(1);
  });
});

function result(testId: string, title: string, status: 'passed' | 'failed', error?: string, failureCategory?: BusinessTestResult['failureCategory']): BusinessTestResult {
  return {
    testId, title, project: 'chromium', status, rawStatus: status, durationMs: 100, totalDurationMs: 100,
    retriesUsed: 0, flaky: false, tags: [], steps: [], error, failureCategory,
    attempts: [{ retry: 0, status, durationMs: 100, error, failureCategory }]
  };
}

function noHealing(): HealingSummary {
  return { count: 0, fallback: 0, cache: 0, ai: 0, affectedTests: 0, records: [] };
}
