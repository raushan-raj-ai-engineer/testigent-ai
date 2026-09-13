import { balanceByDuration, type DurationPlanItem } from '../execution/duration-balancer.js';
import { hasCompleteBenchmarkProvenance } from './benchmark-provenance.js';
import type { ScaleCertificationResult, ScaleExecutionEvidence } from './benchmark.types.js';

/** Builds a deterministic planning load used to exercise shard planning at 100/500/2,000 case sizes. */
export function buildSyntheticScalePlan(caseCount: number, shardCount: number): ReturnType<typeof balanceByDuration> {
  if (!Number.isInteger(caseCount) || caseCount < 1) throw new Error('caseCount must be a positive integer.');
  const items: DurationPlanItem[] = Array.from({ length: caseCount }, (_, index) => ({
    key: `synthetic/case-${index + 1}.spec.ts:1:1`,
    testListLine: `[chromium] › synthetic/case-${index + 1}.spec.ts:1:1 › independent case ${index + 1}`,
    estimatedMs: 500 + ((index * 7919) % 9_500),
  }));
  return balanceByDuration(items, shardCount);
}

/**
 * Evaluates measured scale evidence. Synthetic planning runs are useful diagnostics but never qualify as execution certification.
 */
export function evaluateScaleEvidence(evidence: ScaleExecutionEvidence): ScaleCertificationResult {
  validateEvidence(evidence);
  const imbalance = shardImbalance(evidence.shardDurationsMs);
  const utilization = estimatedUtilization(evidence);
  const reasons: string[] = [];
  if (evidence.synthetic) reasons.push('Synthetic evidence cannot certify real browser/runtime execution scale.');
  if (!hasCompleteBenchmarkProvenance(evidence)) reasons.push('Benchmark provenance is incomplete; version, commit, runtime/platform, environment, methodology, evidence reference and SHA-256 are required.');
  if (evidence.executedCases !== evidence.caseCount) reasons.push(`Executed ${evidence.executedCases}/${evidence.caseCount} expected cases.`);
  if (evidence.duplicateCases > 0) reasons.push(`${evidence.duplicateCases} duplicate case(s) detected.`);
  if (evidence.droppedCases > 0) reasons.push(`${evidence.droppedCases} dropped case(s) detected.`);
  if (imbalance !== null && imbalance > 25) reasons.push(`Shard imbalance ${imbalance}% exceeds the 25% evidence threshold.`);
  const incomplete = evidence.synthetic || !hasCompleteBenchmarkProvenance(evidence) || evidence.caseCount < 100;
  const failed = evidence.executedCases !== evidence.caseCount || evidence.duplicateCases > 0 || evidence.droppedCases > 0 || (imbalance !== null && imbalance > 25);
  return {
    status: failed ? 'FAIL' : incomplete ? 'INSUFFICIENT_EVIDENCE' : 'PASS',
    caseCount: evidence.caseCount,
    executedCases: evidence.executedCases,
    workers: evidence.workers,
    shards: evidence.shards,
    wallClockMs: evidence.wallClockMs,
    shardImbalancePercent: imbalance,
    workerUtilizationPercent: utilization,
    reasons,
    truthBoundary: 'PASS certifies only the supplied measured execution evidence. The built-in synthetic planner validates planning behavior and cannot prove browser, infrastructure or SUT throughput.',
  };
}

function validateEvidence(value: ScaleExecutionEvidence): void {
  if (value.schemaVersion !== 1) throw new Error('Unsupported scale evidence schema.');
  for (const [label, number] of Object.entries({ caseCount: value.caseCount, executedCases: value.executedCases, duplicateCases: value.duplicateCases, droppedCases: value.droppedCases, workers: value.workers, shards: value.shards, wallClockMs: value.wallClockMs })) {
    if (!Number.isFinite(number) || number < 0) throw new Error(`Scale evidence ${label} must be finite and non-negative.`);
  }
  for (const [label, number] of Object.entries({ caseCount: value.caseCount, executedCases: value.executedCases, duplicateCases: value.duplicateCases, droppedCases: value.droppedCases, workers: value.workers, shards: value.shards })) {
    if (!Number.isInteger(number)) throw new Error(`Scale evidence ${label} must be an integer.`);
  }
  if (value.caseCount < 1 || value.workers < 1 || value.shards < 1) throw new Error('caseCount/workers/shards must be positive integers.');
  if (value.wallClockMs <= 0) throw new Error('wallClockMs must be a positive measured duration.');
  if (value.shardDurationsMs.length !== value.shards) throw new Error('shardDurationsMs length must equal shards.');
  if (value.shardDurationsMs.some(item => !Number.isFinite(item) || item < 0) || !value.shardDurationsMs.some(item => item > 0)) throw new Error('Shard durations must be finite/non-negative and include at least one measured duration.');
}
function shardImbalance(values: number[]): number | null {
  if (!values.length) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average === 0) return 0;
  return round((Math.max(...values) - Math.min(...values)) / average * 100);
}
function estimatedUtilization(evidence: ScaleExecutionEvidence): number | null {
  if (!evidence.wallClockMs || !evidence.shardDurationsMs.length) return null;
  const active = evidence.shardDurationsMs.reduce((sum, value) => sum + value, 0);
  const capacity = evidence.wallClockMs * Math.max(1, Math.min(evidence.workers, evidence.shards));
  return round(Math.min(100, active / capacity * 100));
}
function round(value: number): number { return Math.round(value * 100) / 100; }
