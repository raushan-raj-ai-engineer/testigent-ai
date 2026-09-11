import type {
  BusinessTestResult,
  ExecutionFacts,
  HealingSummary,
  AiRuntimeUsageSummary,
  TestLayer,
  TestLayerSummary,
  TestType,
  TestTypeSummary
} from './report.types';
import { buildFailureClusters } from './failure.clusterer';
import { buildFlakySummary } from './flaky.analyzer';
import { buildBusinessImpacts } from './business-impact';
import { classifyTestLayers } from './test-layer.classifier';
import { buildSkipSummary } from '../reporting/skip-reason.classifier';
import { buildBusinessOutcomeSummary, enrichBusinessOutcomes } from './business-outcome';

/**
 * Author: Raushan Raj
 * Business Use: Creates the immutable factual dataset used by dashboard, notifications and AI narration.
 * How to use: Pass final test results, healing records and run metadata to buildExecutionFacts().
 * Benefit: Counts, business outcomes, quality gate, test-layer categorization, retries, healing and clusters are deterministic.
 */
export function buildExecutionFacts(input: {
  runId: string;
  environment: string;
  application: string;
  generatedAt?: string;
  results: BusinessTestResult[];
  healing: HealingSummary;
  aiUsage?: AiRuntimeUsageSummary;
  scope?: { excludedInternalTests?: number; internalTestsIncluded?: boolean };
}): ExecutionFacts {
  const classifiedResults = input.results.map(result => {
    const classification = result.layers?.length
      ? { layers: result.layers, testType: result.testType ?? classifyTestLayers(result.tags, result.sourceFile).testType }
      : classifyTestLayers(result.tags, result.sourceFile);
    return { ...result, ...classification };
  });
  const normalizedResults = enrichBusinessOutcomes(classifiedResults, input.healing);
  const outcomes = buildBusinessOutcomeSummary(normalizedResults);

  // Raw execution counts are retained for backward compatibility and technical correlation.
  const passed = normalizedResults.filter(result => result.status === 'passed').length;
  const failed = normalizedResults.filter(result => result.status === 'failed').length;
  const skipped = normalizedResults.filter(result => result.status === 'skipped').length;
  const total = normalizedResults.length;
  const executed = passed + failed;
  const skipBreakdown = buildSkipSummary(normalizedResults);
  const notApplicable = skipBreakdown.categories
    .filter(category => category.disposition === 'NOT_APPLICABLE')
    .reduce((sum, category) => sum + category.count, 0);
  const blockedSkipped = skipBreakdown.categories
    .filter(category => category.disposition === 'BLOCKED')
    .reduce((sum, category) => sum + category.count, 0);
  const executionEligible = Math.max(0, total - notApplicable);
  const executionRate = executionEligible ? Number(((executed / executionEligible) * 100).toFixed(2)) : 0;
  const executedPassRate = executed ? Number(((passed / executed) * 100).toFixed(2)) : 0;
  const failureClusters = buildFailureClusters(normalizedResults.filter(result => result.outcome !== 'KNOWN_DEFECT'));
  const businessImpacts = buildBusinessImpacts(normalizedResults);
  const failureCategoryCounts: Record<string, number> = {};
  for (const result of normalizedResults.filter(item => item.qualityStatus === 'FAIL')) {
    const category = result.failureCategory ?? (result.outcome === 'KNOWN_DEFECT' ? 'KNOWN_DEFECT' : 'UNKNOWN');
    failureCategoryCounts[category] = (failureCategoryCounts[category] ?? 0) + 1;
  }

  const layerCounts: TestLayerSummary = { UI: 0, API: 0, DATABASE: 0, OTHER: 0 };
  const testTypeCounts: TestTypeSummary = {
    UI_ONLY: 0,
    API_ONLY: 0,
    DATABASE_ONLY: 0,
    UI_API: 0,
    UI_DATABASE: 0,
    API_DATABASE: 0,
    UI_API_DATABASE: 0,
    OTHER: 0
  };
  for (const result of normalizedResults.filter(item => item.status !== 'skipped')) {
    const layers = result.layers ?? [];
    if (!layers.length) layerCounts.OTHER += 1;
    for (const layer of layers as TestLayer[]) layerCounts[layer] += 1;
    testTypeCounts[(result.testType ?? 'OTHER') as TestType] += 1;
  }

  // Legacy passRate keeps the original total-based metric; business UI uses qualityPassRate.
  const passRate = total ? Number(((passed / total) * 100).toFixed(2)) : 0;
  const passThreshold = Number(process.env.BUSINESS_PASS_THRESHOLD ?? 95);
  const highImpactFailures = businessImpacts
    .filter(impact => impact.priority === 'HIGH')
    .reduce((sum, impact) => sum + impact.affectedTests, 0);
  const blockingReasons: string[] = [];
  if (executionEligible === 0 && total > 0) blockingReasons.push('No applicable business scenario was available for execution in the selected scope.');
  if (blockedSkipped > 0) blockingReasons.push(`${blockedSkipped} applicable scenario(s) were blocked before execution by configuration, review or dependency prerequisites.`);
  if (outcomes.unexpectedFailed > 0) blockingReasons.push(`${outcomes.unexpectedFailed} unexpected failed scenario(s) require investigation.`);
  if (outcomes.unexpectedPass > 0) blockingReasons.push(`${outcomes.unexpectedPass} known-defect scenario(s) unexpectedly passed; verify the defect is fixed and remove stale expected-failure markers.`);

  const acceptedRiskReasons: string[] = [];
  if (outcomes.knownDefects > 0) acceptedRiskReasons.push(`${outcomes.knownDefects} accepted known defect(s) remain as quality debt but are not CI-blocking.`);
  if (executed > 0 && outcomes.qualityPassRate < passThreshold && outcomes.unexpectedFailed === 0) {
    acceptedRiskReasons.push(`Quality pass rate ${outcomes.qualityPassRate}% is below the ${passThreshold}% target because accepted defect debt remains.`);
  }
  if (notApplicable > 0) acceptedRiskReasons.push(`${notApplicable} selected scenario(s) were not applicable to this project/environment and are excluded from execution coverage.`);

  const acceptedRiskOnly = blockingReasons.length === 0 && outcomes.knownDefects > 0;
  const qualityGate = {
    status: blockingReasons.length > 0
      ? 'ATTENTION_REQUIRED' as const
      : acceptedRiskOnly
        ? 'PASSED_WITH_ACCEPTED_RISK' as const
        : 'PASSED' as const,
    passThreshold,
    highImpactFailures,
    reasons: blockingReasons.length > 0 ? blockingReasons : acceptedRiskReasons
  };

  return {
    runId: input.runId,
    environment: input.environment,
    application: input.application,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    total,
    passed,
    failed,
    skipped,
    outcomes,
    knownDefects: outcomes.knownDefects,
    unexpectedFailed: outcomes.unexpectedFailed,
    unexpectedPass: outcomes.unexpectedPass,
    qualityFailed: outcomes.qualityFailed,
    ciBlockingIssues: outcomes.ciBlockingIssues,
    qualityPassRate: outcomes.qualityPassRate,
    executed,
    executionEligible,
    executionRate,
    notApplicable,
    blockedSkipped,
    executedPassRate,
    passRate,
    skipBreakdown,
    durationMs: normalizedResults.filter(result => result.status !== 'skipped').reduce((sum, result) => sum + result.totalDurationMs, 0),
    healing: input.healing,
    aiUsage: input.aiUsage ?? { calls: 0, healingCalls: 0, reportingCalls: 0, successfulCalls: 0, noResultCalls: 0, errorCalls: 0, budgetBlockedCalls: 0, averageLatencyMs: 0, providers: [], records: [] },
    flakiness: buildFlakySummary(normalizedResults),
    failureClusters,
    failureCategoryCounts,
    businessImpacts,
    layerCounts,
    testTypeCounts,
    qualityGate,
    scope: {
      includedTests: total,
      applicableTests: executionEligible,
      notApplicableTests: notApplicable,
      blockedTests: blockedSkipped,
      excludedInternalTests: input.scope?.excludedInternalTests ?? 0,
      internalTestsIncluded: input.scope?.internalTestsIncluded ?? false,
      description: input.scope?.internalTestsIncluded
        ? 'Business report includes framework/internal validation tests by explicit configuration.'
        : 'Business report contains product/business scenarios; framework/internal validation checks are excluded.'
    },
    results: normalizedResults
  };
}
