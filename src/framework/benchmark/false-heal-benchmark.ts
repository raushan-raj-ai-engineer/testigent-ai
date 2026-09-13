import type { FalseHealBenchmarkResult, FalseHealScenario } from './benchmark.types.js';

/** Evaluates seeded business-defect scenarios separately from successful locator recovery. */
export function evaluateFalseHealSafety(scenarios: FalseHealScenario[]): FalseHealBenchmarkResult {
  if (!scenarios.length) return { scenarios: 0, injectedBusinessFailures: 0, falseHeals: 0, falseHealRatePercent: null, status: 'INSUFFICIENT_EVIDENCE' };
  const failures = scenarios.filter(item => item.expectedBusinessOutcome === 'FAIL');
  if (!failures.length) return { scenarios: scenarios.length, injectedBusinessFailures: 0, falseHeals: 0, falseHealRatePercent: null, status: 'INSUFFICIENT_EVIDENCE' };
  const falseHeals = failures.filter(item => item.observedAutomationOutcome !== 'FAILED').length;
  const rate = round(falseHeals / failures.length * 100);
  return {
    scenarios: scenarios.length,
    injectedBusinessFailures: failures.length,
    falseHeals,
    falseHealRatePercent: rate,
    status: falseHeals === 0 ? 'PASS' : 'FAIL',
  };
}
function round(value: number): number { return Math.round(value * 100) / 100; }
