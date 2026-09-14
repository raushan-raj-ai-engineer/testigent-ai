import { ADOPTION_METRICS, type AdoptionMetricSummary, type AdoptionObservation, type AdoptionSummary } from './adoption.types.js';

/** Computes evidence-backed pilot metrics without turning sparse observations into product claims. */
export function analyzeAdoption(observations: AdoptionObservation[]): AdoptionSummary {
  const applications = [...new Set(observations.map(item => item.application))].sort();
  const contributors = [...new Set(observations.map(item => item.contributorKey).filter((value): value is string => Boolean(value)))].sort();
  const pilotStatus: AdoptionSummary['pilotStatus'] = applications.length >= 2 && contributors.length >= 2
    ? 'PILOT_EVIDENCE_READY'
    : 'INSUFFICIENT_EVIDENCE';
  const metrics = ADOPTION_METRICS.flatMap(metric => {
    const records = observations.filter(item => item.metric === metric);
    if (!records.length) return [];
    return [summarizeMetric(metric, records, pilotStatus)];
  });
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    observations: observations.length,
    applications,
    contributors,
    pilotStatus,
    metrics,
    truthBoundary: 'Measured values are reported as observations. Comparative improvement claims require at least two representative applications, two opaque contributor aliases and three baseline-backed samples for the metric.',
  };
}

function summarizeMetric(metric: AdoptionObservation['metric'], records: AdoptionObservation[], pilotStatus: AdoptionSummary['pilotStatus']): AdoptionMetricSummary {
  const values = records.map(item => item.value);
  const baselines = records.map(item => item.baselineValue).filter((value): value is number => value !== undefined);
  const baselineMedian = baselines.length ? median(baselines) : null;
  const currentMedian = median(values);
  const medianDeltaPercent = baselineMedian && baselineMedian > 0 ? round(((currentMedian - baselineMedian) / baselineMedian) * 100) : null;
  let claimStatus: AdoptionMetricSummary['claimStatus'] = 'MEASURED';
  if (pilotStatus !== 'PILOT_EVIDENCE_READY' || baselines.length < 3 || medianDeltaPercent === null) claimStatus = 'INSUFFICIENT_EVIDENCE';
  else if (Math.abs(medianDeltaPercent) < 0.01) claimStatus = 'UNCHANGED';
  else if (isLowerBetter(metric) ? medianDeltaPercent < 0 : medianDeltaPercent > 0) claimStatus = 'IMPROVED';
  else claimStatus = 'REGRESSED';
  return {
    metric,
    unit: records[0]!.unit,
    samples: records.length,
    median: currentMedian,
    p90: percentile(values, 0.9),
    average: round(values.reduce((sum, value) => sum + value, 0) / values.length),
    baselineSamples: baselines.length,
    baselineMedian,
    medianDeltaPercent,
    claimStatus,
  };
}

function isLowerBetter(metric: AdoptionObservation['metric']): boolean {
  return !['report-completeness-percent', 'clean-pass-rate-percent'].includes(metric);
}
function median(values: number[]): number { return percentile(values, 0.5); }
function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return round(sorted[index]!);
}
function round(value: number): number { return Math.round(value * 100) / 100; }
