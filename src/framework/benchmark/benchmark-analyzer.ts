import { summarizeComparativeBenchmark } from './comparative-benchmark.js';
import { evaluateScaleEvidence } from './scale-certification.js';
import { evaluateFalseHealSafety } from './false-heal-benchmark.js';
import { hasCompleteBenchmarkProvenance } from './benchmark-provenance.js';
import type { ComparativeBenchmarkSample, ComparativeBenchmarkSummary, FalseHealBenchmarkEvidence, FalseHealBenchmarkResult, ScaleCertificationResult, ScaleExecutionEvidence } from './benchmark.types.js';

export interface BenchmarkIntelligenceSummary {
  comparative: ComparativeBenchmarkSummary;
  scale: Array<{ id: string; application: string; datasetVersion: string; result: ScaleCertificationResult }>;
  scalePasses: number;
  scaleFailures: number;
  scaleInsufficient: number;
  falseHeal: Array<{ id: string; application: string; datasetVersion: string; result: FalseHealBenchmarkResult }>;
  falseHealPasses: number;
  falseHealFailures: number;
  falseHealInsufficient: number;
}

/** Aggregates comparative, scale, and false-heal benchmark evidence without promoting incomplete provenance into claims. */
export function analyzeBenchmarks(comparative: ComparativeBenchmarkSample[], scale: ScaleExecutionEvidence[], falseHeal: FalseHealBenchmarkEvidence[] = []): BenchmarkIntelligenceSummary {
  const scaleResults = scale.map(item => ({ id: item.id, application: item.application, datasetVersion: item.datasetVersion, result: evaluateScaleEvidence(item) }));
  const falseHealResults = falseHeal.map(item => {
    const measured = evaluateFalseHealSafety(item.scenarios);
    const result = item.synthetic || !hasCompleteBenchmarkProvenance(item)
      ? { ...measured, status: 'INSUFFICIENT_EVIDENCE' as const }
      : measured;
    return { id: item.id, application: item.application, datasetVersion: item.datasetVersion, result };
  });
  return {
    comparative: summarizeComparativeBenchmark(comparative),
    scale: scaleResults,
    scalePasses: scaleResults.filter(item => item.result.status === 'PASS').length,
    scaleFailures: scaleResults.filter(item => item.result.status === 'FAIL').length,
    scaleInsufficient: scaleResults.filter(item => item.result.status === 'INSUFFICIENT_EVIDENCE').length,
    falseHeal: falseHealResults,
    falseHealPasses: falseHealResults.filter(item => item.result.status === 'PASS').length,
    falseHealFailures: falseHealResults.filter(item => item.result.status === 'FAIL').length,
    falseHealInsufficient: falseHealResults.filter(item => item.result.status === 'INSUFFICIENT_EVIDENCE').length,
  };
}
