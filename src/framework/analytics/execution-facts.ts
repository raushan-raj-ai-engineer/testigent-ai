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

/**
 * Author: Raushan Raj
 * Business Use: Creates the immutable factual dataset used by dashboard, notifications and AI narration.
 * How to use: Pass final test results, healing records and run metadata to buildExecutionFacts().
 * Benefit: Counts, quality gate, test-layer categorization, retries, healing and clusters are deterministic.
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
  const normalizedResults = input.results.map(result => {
    const classification = result.layers?.length
      ? { layers: result.layers, testType: result.testType ?? classifyTestLayers(result.tags, result.sourceFile).testType }
      : classifyTestLayers(result.tags, result.sourceFile);
    return { ...result, ...classification };
  });

  const passed = normalizedResults.filter(result => result.status === 'passed').length;
  const failed = normalizedResults.filter(result => result.status === 'failed').length;
  const skipped = normalizedResults.filter(result => result.status === 'skipped').length;
  const total = normalizedResults.length;
  const executed = passed + failed;
  const executionRate = total ? Number(((executed / total) * 100).toFixed(2)) : 0;
  const executedPassRate = executed ? Number(((passed / executed) * 100).toFixed(2)) : 0;
  const skipBreakdown = buildSkipSummary(normalizedResults);
  const failureClusters = buildFailureClusters(normalizedResults);
  const businessImpacts = buildBusinessImpacts(normalizedResults);
  const failureCategoryCounts: Record<string, number> = {};
  for (const result of normalizedResults.filter(item => item.status === 'failed')) {
    const category = result.failureCategory ?? 'UNKNOWN';
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
  for (const result of normalizedResults) {
    const layers = result.layers ?? [];
    if (!layers.length) layerCounts.OTHER += 1;
    for (const layer of layers as TestLayer[]) layerCounts[layer] += 1;
    testTypeCounts[(result.testType ?? 'OTHER') as TestType] += 1;
  }

  const passRate = total ? Number(((passed / total) * 100).toFixed(2)) : 0;
  const passThreshold = Number(process.env.BUSINESS_PASS_THRESHOLD ?? 95);
  const highImpactFailures = businessImpacts
    .filter(impact => impact.priority === 'HIGH')
    .reduce((sum, impact) => sum + impact.affectedTests, 0);
  const reasons: string[] = [];
  if (executed === 0 && total > 0) reasons.push('No business scenarios executed; all included scenarios were skipped.');
  if (executed > 0 && executedPassRate < passThreshold) reasons.push(`Executed pass rate ${executedPassRate}% is below configured threshold ${passThreshold}%.`);
  if (highImpactFailures > 0) reasons.push(`${highImpactFailures} high-impact failed scenario(s) require attention.`);
  const qualityGate = {
    status: reasons.length ? 'ATTENTION_REQUIRED' as const : 'PASSED' as const,
    passThreshold,
    highImpactFailures,
    reasons
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
    executed,
    executionRate,
    executedPassRate,
    passRate,
    skipBreakdown,
    durationMs: normalizedResults.reduce((sum, result) => sum + result.totalDurationMs, 0),
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
      excludedInternalTests: input.scope?.excludedInternalTests ?? 0,
      internalTestsIncluded: input.scope?.internalTestsIncluded ?? false,
      description: input.scope?.internalTestsIncluded
        ? 'Business report includes framework/internal validation tests by explicit configuration.'
        : 'Business report contains product/business scenarios; framework/internal validation checks are excluded.'
    },
    results: normalizedResults
  };
}
