import type { BusinessOutcome, BusinessOutcomeSummary, BusinessTestResult, HealingSummary } from './report.types';

/**
 * Author: Raushan Raj
 * Business Use: Separates raw Playwright execution status from stakeholder-facing quality outcome.
 * How to use: buildExecutionFacts() calls enrichBusinessOutcomes() after retries/healing/known-defect evidence is known.
 * Benefit: Expected known defects remain visible as quality failures without becoming CI-blocking, while unexpected failures and unexpected passes stay actionable.
 */
export function enrichBusinessOutcomes(results: BusinessTestResult[], healing: HealingSummary): BusinessTestResult[] {
  const healed = new Set(healing.records.map(record => record.testId).filter((value): value is string => Boolean(value)));
  return results.map(result => {
    const outcome = classifyBusinessOutcome(result, healed.has(result.testId));
    const qualityStatus: BusinessTestResult['qualityStatus'] = outcome === 'SKIPPED'
      ? 'NEUTRAL'
      : outcome === 'KNOWN_DEFECT' || outcome === 'FAILED'
        ? 'FAIL'
        : 'PASS';
    const ciBlocking = outcome === 'FAILED' || outcome === 'UNEXPECTED_PASS';
    return { ...result, outcome, qualityStatus, ciBlocking };
  });
}

export function classifyBusinessOutcome(result: BusinessTestResult, healed: boolean): BusinessOutcome {
  if (result.status === 'skipped') return 'SKIPPED';
  if (result.knownDefect && result.status === 'failed') return 'KNOWN_DEFECT';
  if (result.knownDefect && result.status === 'passed') return 'UNEXPECTED_PASS';
  if (result.status === 'failed') return 'FAILED';
  if (result.flaky) return 'PASSED_AFTER_RETRY';
  if (healed) return 'PASSED_WITH_HEALING';
  return 'PASSED';
}

export function buildBusinessOutcomeSummary(results: BusinessTestResult[]): BusinessOutcomeSummary {
  const count = (outcome: BusinessOutcome) => results.filter(result => result.outcome === outcome).length;
  const cleanPassed = count('PASSED');
  const passedWithHealing = count('PASSED_WITH_HEALING');
  const passedAfterRetry = count('PASSED_AFTER_RETRY');
  const knownDefects = count('KNOWN_DEFECT');
  const unexpectedFailed = count('FAILED');
  const unexpectedPass = count('UNEXPECTED_PASS');
  const skipped = count('SKIPPED');
  const qualityPassed = cleanPassed + passedWithHealing + passedAfterRetry + unexpectedPass;
  const qualityFailed = unexpectedFailed + knownDefects;
  const qualityExecuted = qualityPassed + qualityFailed;
  return {
    cleanPassed,
    passedWithHealing,
    passedAfterRetry,
    knownDefects,
    unexpectedFailed,
    unexpectedPass,
    skipped,
    qualityPassed,
    qualityFailed,
    ciBlockingIssues: unexpectedFailed + unexpectedPass,
    acceptedDefectDebt: knownDefects,
    toInvestigate: unexpectedFailed + unexpectedPass,
    qualityPassRate: qualityExecuted ? Number(((qualityPassed / qualityExecuted) * 100).toFixed(2)) : 0
  };
}
