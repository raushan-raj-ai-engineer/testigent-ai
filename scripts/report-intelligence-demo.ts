import { buildExecutionFacts } from '../src/framework/analytics/execution-facts';
import type { BusinessTestResult, HealingSummary } from '../src/framework/analytics/report.types';
import { WorkspaceContext } from '../src/framework/core/config/workspace.context';

/**
 * Author: Raushan Raj
 * Business Use: Demonstrates deterministic failure clustering and flaky-test analytics without intentionally breaking the real suite.
 * How to use: npm run intelligence:demo.
 * Benefit: Freshers can understand analytics safely and architects can validate the logic independently of an AUT.
 */
const results: BusinessTestResult[] = [
  sample('auth-1', 'Customer login', 'failed', 'DEPENDENCY', 'Authentication service returned HTTP 503 request 83471'),
  sample('auth-2', 'Admin login', 'failed', 'DEPENDENCY', 'Authentication service returned HTTP 503 request 91222'),
  sample('order-1', 'Order total', 'failed', 'PRODUCT_DEFECT', 'Expected 1000 received 950 for order 834992'),
  {
    ...sample('search-1', 'Product search', 'passed'),
    flaky: true,
    retriesUsed: 1,
    attempts: [
      { retry: 0, status: 'failed', durationMs: 1200, error: 'Timeout waiting for results', failureCategory: 'TEST_DEFECT' },
      { retry: 1, status: 'passed', durationMs: 700 }
    ],
    totalDurationMs: 1900
  }
];
const healing: HealingSummary = { count: 0, fallback: 0, cache: 0, ai: 0, affectedTests: 0, records: [], attempts: [], attemptCount: 0, rejected: 0, suggested: 0, unverified: 0 };
const target = WorkspaceContext.resolve();
const facts = buildExecutionFacts({ runId: 'intelligence-demo', environment: target.environment, application: target.application, results, healing });
console.log(JSON.stringify({
  totals: { total: facts.total, passed: facts.passed, failed: facts.failed, passRate: facts.passRate },
  failureClusters: facts.failureClusters,
  flakiness: facts.flakiness,
  healing: facts.healing
}, null, 2));

function sample(testId: string, title: string, status: 'passed' | 'failed', failureCategory?: BusinessTestResult['failureCategory'], error?: string): BusinessTestResult {
  return {
    testId, title, project: 'chromium', status, rawStatus: status, durationMs: 500, totalDurationMs: 500,
    retriesUsed: 0, flaky: false, tags: [], steps: [], error, failureCategory,
    attempts: [{ retry: 0, status, durationMs: 500, error, failureCategory }]
  };
}
