import type { BusinessTestResult, FlakySummary } from './report.types';

/**
 * Author: Raushan Raj
 * Business Use: Separates stable passes from retry-recovered/flaky automation.
 * How to use: buildFlakySummary(results) inside the business reporter or analytics scripts.
 * Benefit: A green build cannot hide tests that only passed after retry, improving release confidence and maintenance prioritization.
 */
export function buildFlakySummary(results: BusinessTestResult[]): FlakySummary {
  const flaky = results.filter(result => result.flaky);
  return {
    flakyTests: flaky.length,
    retryRecovered: flaky.filter(result => result.status === 'passed').length,
    totalRetryAttempts: results.reduce((sum, result) => sum + result.retriesUsed, 0),
    tests: flaky.map(result => ({
      testId: result.testId,
      title: result.title,
      project: result.project,
      attempts: result.attempts
    }))
  };
}
