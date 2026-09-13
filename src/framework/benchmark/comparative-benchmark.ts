import { hasCompleteBenchmarkProvenance } from './benchmark-provenance.js';
import type { ComparativeBenchmarkSample, ComparativeBenchmarkSummary, ComparativeMetricResult } from './benchmark.types.js';

/** Compare TestigentAI measurements with an explicitly supplied baseline; no vendor or synthetic values are treated as market proof. */
export function summarizeComparativeBenchmark(samples: ComparativeBenchmarkSample[]): ComparativeBenchmarkSummary {
  validateSamples(samples);
  const applications = [...new Set(samples.map(item => item.application))].sort();
  const baselineLabels = [...new Set(samples.map(item => item.baselineLabel))].sort();
  const datasetVersions = [...new Set(samples.map(item => item.datasetVersion))].sort();
  const groups = new Map<string, ComparativeBenchmarkSample[]>();
  for (const sample of samples) {
    const key = `${sample.datasetVersion}\u0000${sample.baselineLabel}\u0000${sample.metric}`;
    const group = groups.get(key) ?? [];
    group.push(sample);
    groups.set(key, group);
  }
  const metrics = [...groups.values()]
    .sort((a, b) => `${a[0]!.datasetVersion}|${a[0]!.baselineLabel}|${a[0]!.metric}`.localeCompare(`${b[0]!.datasetVersion}|${b[0]!.baselineLabel}|${b[0]!.metric}`))
    .map(group => summarizeMetric(group[0]!.metric, group));
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    baselineLabels,
    datasetVersions,
    applications,
    metrics,
    differentiationStatus: applications.length >= 2 && metrics.some(item => item.result !== 'INSUFFICIENT_EVIDENCE') ? 'EVIDENCE_READY' : 'INSUFFICIENT_EVIDENCE',
    truthBoundary: 'Competitive differentiation requires repeatable baseline-backed measurements across at least two representative applications within the same dataset version and baseline label. Synthetic/test-fixture samples never graduate a product claim.',
  };
}

function summarizeMetric(metric: ComparativeBenchmarkSample['metric'], samples: ComparativeBenchmarkSample[]): ComparativeMetricResult {
  const applications = [...new Set(samples.map(item => item.application))].sort();
  const baselineMedian = median(samples.map(item => item.baselineValue));
  const testigentMedian = median(samples.map(item => item.testigentValue));
  const deltaPercent = baselineMedian > 0 ? round(((testigentMedian - baselineMedian) / baselineMedian) * 100) : 0;
  const eligible = baselineMedian > 0 && samples.length >= 3 && applications.length >= 2 && samples.every(hasCompleteBenchmarkProvenance);
  let result: ComparativeMetricResult['result'] = 'INSUFFICIENT_EVIDENCE';
  if (eligible) {
    if (Math.abs(deltaPercent) < 0.01) result = 'UNCHANGED';
    else if (lowerIsBetter(metric) ? deltaPercent < 0 : deltaPercent > 0) result = 'IMPROVED';
    else result = 'REGRESSED';
  }
  return { metric, datasetVersion: samples[0]!.datasetVersion, baselineLabel: samples[0]!.baselineLabel, unit: samples[0]!.unit, samples: samples.length, applications, baselineMedian, testigentMedian, deltaPercent, result };
}

function validateSamples(samples: ComparativeBenchmarkSample[]): void {
  for (const item of samples) {
    if (item.schemaVersion !== 1) throw new Error(`Unsupported benchmark sample schema for '${item.id}'.`);
    if (!item.id.trim() || !item.application.trim() || !item.datasetVersion.trim() || !item.baselineLabel.trim() || !item.evidenceRef.trim()) throw new Error(`Benchmark sample '${item.id}' is missing provenance.`);
    if (!Number.isFinite(item.baselineValue) || item.baselineValue < 0 || !Number.isFinite(item.testigentValue) || item.testigentValue < 0) throw new Error(`Benchmark sample '${item.id}' has invalid values.`);
  }
}
function lowerIsBetter(metric: ComparativeBenchmarkSample['metric']): boolean { return metric !== 'report-completeness-percent'; }
function median(values: number[]): number { const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return round(sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2); }
function round(value: number): number { return Math.round(value * 100) / 100; }
