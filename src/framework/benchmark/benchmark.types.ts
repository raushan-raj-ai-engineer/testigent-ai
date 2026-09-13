export type ComparativeBenchmarkMetric =
  | 'authoring-minutes'
  | 'triage-minutes'
  | 'ci-wall-minutes'
  | 'migration-minutes'
  | 'report-completeness-percent'
  | 'ai-cost-usd';

export interface BenchmarkProvenance {
  productVersion: string;
  commit: string;
  runtime: string;
  platform: string;
  environmentDescription: string;
  methodology: string;
  evidenceRef: string;
  evidenceSha256: string;
  exclusions?: string[];
}

export interface ComparativeBenchmarkSample extends BenchmarkProvenance {
  schemaVersion: 1;
  id: string;
  application: string;
  datasetVersion: string;
  metric: ComparativeBenchmarkMetric;
  unit: 'minutes' | 'percent' | 'usd';
  baselineLabel: string;
  baselineValue: number;
  testigentValue: number;
}

export interface ComparativeMetricResult {
  metric: ComparativeBenchmarkMetric;
  datasetVersion: string;
  baselineLabel: string;
  unit: ComparativeBenchmarkSample['unit'];
  samples: number;
  applications: string[];
  baselineMedian: number;
  testigentMedian: number;
  deltaPercent: number;
  result: 'IMPROVED' | 'REGRESSED' | 'UNCHANGED' | 'INSUFFICIENT_EVIDENCE';
}

export interface ComparativeBenchmarkSummary {
  schemaVersion: 1;
  generatedAt: string;
  baselineLabels: string[];
  datasetVersions: string[];
  applications: string[];
  metrics: ComparativeMetricResult[];
  differentiationStatus: 'INSUFFICIENT_EVIDENCE' | 'EVIDENCE_READY';
  truthBoundary: string;
}

export interface FalseHealScenario {
  id: string;
  injectedFault: string;
  expectedBusinessOutcome: 'PASS' | 'FAIL';
  observedAutomationOutcome: 'CLEAN_PASS' | 'FAILED' | 'HEALED_PASS' | 'RETRY_PASS';
}


export interface FalseHealBenchmarkEvidence extends BenchmarkProvenance {
  schemaVersion: 1;
  id: string;
  application: string;
  environment: string;
  datasetVersion: string;
  scenarios: FalseHealScenario[];
  synthetic?: boolean;
}

export interface FalseHealBenchmarkResult {
  scenarios: number;
  injectedBusinessFailures: number;
  falseHeals: number;
  falseHealRatePercent: number | null;
  status: 'PASS' | 'FAIL' | 'INSUFFICIENT_EVIDENCE';
}

export interface ScaleExecutionEvidence extends BenchmarkProvenance {
  schemaVersion: 1;
  id: string;
  application: string;
  environment: string;
  datasetVersion: string;
  selection: string;
  profile?: string;
  lane?: string;
  caseCount: number;
  executedCases: number;
  duplicateCases: number;
  droppedCases: number;
  workers: number;
  shards: number;
  wallClockMs: number;
  shardDurationsMs: number[];
  reportMergeMs?: number;
  peakRssMb?: number;
  failures?: string[];
  synthetic?: boolean;
}

export interface ScaleCertificationResult {
  status: 'PASS' | 'FAIL' | 'INSUFFICIENT_EVIDENCE';
  caseCount: number;
  executedCases: number;
  workers: number;
  shards: number;
  wallClockMs: number;
  shardImbalancePercent: number | null;
  workerUtilizationPercent: number | null;
  reasons: string[];
  truthBoundary: string;
}
