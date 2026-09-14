import type { ExecutionFacts } from '../analytics/report.types.js';
import type { FailureSignal } from './failure-intelligence.types.js';

/** Converts server-owned execution facts into LIVE failure signals without upgrading free-text guesses into structured evidence. */
export function failureSignalsFromExecutionFacts(facts: ExecutionFacts): FailureSignal[] {
  return facts.results.filter(result => result.status === 'failed' || result.flaky || result.outcome === 'KNOWN_DEFECT').map(result => {
    const error = result.error ?? result.attempts.find(attempt => attempt.error)?.error ?? '';
    const attachment = (result.attachments ?? []).find(item => item.reportPath || item.sourcePath);
    const trace = (result.attachments ?? []).find(item => /trace/i.test(item.name) || item.contentType.includes('zip'));
    const screenshot = (result.attachments ?? []).find(item => item.contentType.startsWith('image/'));
    const category = result.failureCategory;
    const signal: FailureSignal = {
      scenarioId: result.testId, title: result.title, application: facts.application, project: result.project,
      businessStep: deepestFailedStep(result.stepDetails) ?? result.steps.at(-1), error, flaky: result.flaky,
      retriesUsed: result.retriesUsed, knownDefectId: result.knownDefect?.id,
      evidenceMode: 'LIVE', synthetic: false, claimEligible: Boolean(attachment || error || result.knownDefect),
      ...(trace?.reportPath || trace?.sourcePath ? { traceRef: trace.reportPath ?? trace.sourcePath } : {}),
      ...(screenshot?.reportPath || screenshot?.sourcePath ? { screenshotRef: screenshot.reportPath ?? screenshot.sourcePath } : {}),
    };
    // Legacy reporter categories are text-heuristic outputs. Preserve them only as provenance-labelled hints;
    // never promote them into structured signals that the evidence-first classifier treats as authoritative.
    if (category) signal.legacyCategoryHint = category;
    // Authentication, environment, test-data and API-contract truth require typed producer-owned evidence.
    // Never infer them from a legacy keyword category or words like "contract", "schema" or "token".
    return signal;
  });
}
function deepestFailedStep(steps: ExecutionFacts['results'][number]['stepDetails']): string | undefined { if (!steps?.length) return undefined; let last: string | undefined; const visit = (items: NonNullable<typeof steps>) => { for (const item of items) { if (item.status === 'failed') last = item.title; if (item.children?.length) visit(item.children); } }; visit(steps); return last; }
