import type { ExecutionFacts } from '../analytics/report.types.js';
import type { FailureSignal } from './failure-intelligence.types.js';

/** Converts deterministic execution facts into the richer failure-intelligence signal contract without inventing missing evidence. */
export function failureSignalsFromExecutionFacts(facts: ExecutionFacts): FailureSignal[] {
  return facts.results.filter(result => result.status === 'failed' || result.flaky || result.outcome === 'KNOWN_DEFECT').map(result => {
    const error = result.error ?? result.attempts.find(attempt => attempt.error)?.error ?? '';
    const attachment = (result.attachments ?? []).find(item => item.reportPath || item.sourcePath);
    const trace = (result.attachments ?? []).find(item => /trace/i.test(item.name) || item.contentType.includes('zip'));
    const screenshot = (result.attachments ?? []).find(item => item.contentType.startsWith('image/'));
    const category = result.failureCategory;
    const signal: FailureSignal = {
      scenarioId: result.testId,
      title: result.title,
      application: facts.application,
      project: result.project,
      businessStep: deepestFailedStep(result.stepDetails) ?? result.steps.at(-1),
      error,
      flaky: result.flaky,
      retriesUsed: result.retriesUsed,
      knownDefectId: result.knownDefect?.id,
      evidenceMode: 'LIVE',
      synthetic: false,
      claimEligible: true,
      ...(trace?.reportPath || trace?.sourcePath ? { traceRef: trace.reportPath ?? trace.sourcePath } : {}),
      ...(screenshot?.reportPath || screenshot?.sourcePath ? { screenshotRef: screenshot.reportPath ?? screenshot.sourcePath } : {}),
    };
    if (category === 'TEST_DEFECT') signal.locatorSignal = error || 'automation failure category';
    if (category === 'DATA_DEFECT') signal.testDataSignal = error || 'test data failure category';
    if (category === 'ENVIRONMENT') signal.environmentSignal = error || 'environment failure category';
    if (/auth|session|jwt|access token|refresh token|unauthorized|http 401|\b401\b/i.test(error)) signal.authStatus = /expired/i.test(error) ? 'EXPIRED' : /not configured|missing credential/i.test(error) ? 'NOT_CONFIGURED' : 'INVALID';
    if (/openapi|contract|schema/i.test(error) && category !== 'DATA_DEFECT') signal.contractViolation = error;
    if (!attachment && !error && !result.knownDefect) signal.claimEligible = false;
    return signal;
  });
}

function deepestFailedStep(steps: ExecutionFacts['results'][number]['stepDetails']): string | undefined {
  if (!steps?.length) return undefined;
  let last: string | undefined;
  const visit = (items: NonNullable<typeof steps>) => {
    for (const item of items) {
      if (item.status === 'failed') last = item.title;
      if (item.children?.length) visit(item.children);
    }
  };
  visit(steps);
  return last;
}
