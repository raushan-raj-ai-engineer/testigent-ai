/** Supported pilot/adoption metrics that may be persisted and aggregated as evidence. */
export const ADOPTION_METRICS = [
  'authoring-session-minutes',
  'time-to-first-pass-minutes',
  'requirement-to-approved-test-minutes',
  'migration-minutes',
  'triage-minutes',
  'ci-wall-minutes',
  'ci-cost-usd',
  'ai-cost-usd',
  'report-completeness-percent',
  'clean-pass-rate-percent',
  'retry-pass-rate-percent',
  'false-heal-rate-percent',
] as const;

export type AdoptionMetric = typeof ADOPTION_METRICS[number];
export type AdoptionObservationSource = 'measured' | 'imported';

export interface AdoptionObservation {
  schemaVersion: 1;
  id: string;
  recordedAt: string;
  application: string;
  environment: string;
  metric: AdoptionMetric;
  value: number;
  unit: 'minutes' | 'percent' | 'usd';
  source: AdoptionObservationSource;
  contributorKey?: string;
  baselineValue?: number;
  evidenceRef?: string;
  note?: string;
}

export interface AdoptionMetricSummary {
  metric: AdoptionMetric;
  unit: AdoptionObservation['unit'];
  samples: number;
  median: number;
  p90: number;
  average: number;
  baselineSamples: number;
  baselineMedian: number | null;
  medianDeltaPercent: number | null;
  claimStatus: 'INSUFFICIENT_EVIDENCE' | 'MEASURED' | 'IMPROVED' | 'REGRESSED' | 'UNCHANGED';
}

export interface AdoptionSummary {
  schemaVersion: 1;
  generatedAt: string;
  observations: number;
  applications: string[];
  contributors: string[];
  pilotStatus: 'INSUFFICIENT_EVIDENCE' | 'PILOT_EVIDENCE_READY';
  metrics: AdoptionMetricSummary[];
  truthBoundary: string;
}
