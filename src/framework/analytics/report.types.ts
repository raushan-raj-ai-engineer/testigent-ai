/**
 * Author: Raushan Raj
 * Business Use: Shared deterministic reporting contracts for business, engineering, dashboard and AI layers.
 * How to use: Reporter records BusinessTestResult and structured test steps; analytics utilities derive ExecutionFacts.
 * Benefit: Business metrics remain deterministic while users can drill from executive KPIs into exact test-step evidence.
 */
import type { FailureCategory } from '../ai/failure.classifier';
import type { HealingDecision } from '../healing/healing.types';

export type TestLayer = 'UI' | 'API' | 'DATABASE';
export type TestType =
  | 'UI_ONLY'
  | 'API_ONLY'
  | 'DATABASE_ONLY'
  | 'UI_API'
  | 'UI_DATABASE'
  | 'API_DATABASE'
  | 'UI_API_DATABASE'
  | 'OTHER';

export interface BusinessAttempt {
  retry: number;
  status: string;
  durationMs: number;
  error?: string;
  failureCategory?: FailureCategory;
}

export interface BusinessStepDetail {
  title: string;
  category: string;
  durationMs: number;
  status: 'passed' | 'failed' | 'skipped';
  error?: string;
  location?: { file?: string; line?: number; column?: number };
  params?: Record<string, unknown>;
  children: BusinessStepDetail[];
}

export interface BusinessAttachment {
  name: string;
  contentType: string;
  sourcePath?: string;
  reportPath?: string;
}

export interface BusinessTestResult {
  testId: string;
  title: string;
  project: string;
  status: 'passed' | 'failed' | 'skipped';
  rawStatus: string;
  durationMs: number;
  totalDurationMs: number;
  retriesUsed: number;
  flaky: boolean;
  tags: string[];
  /** Flat business step names retained for backward compatibility and AI summaries. */
  steps: string[];
  stepDetails?: BusinessStepDetail[];
  attachments?: BusinessAttachment[];
  error?: string;
  failureCategory?: FailureCategory;
  attempts: BusinessAttempt[];
  sourceFile?: string;
  layers?: TestLayer[];
  testType?: TestType;
}


export interface AiRuntimeAuditRecord {
  runId: string;
  testId?: string;
  timestamp: string;
  purpose: 'healing' | 'reporting';
  status: 'success' | 'no-result' | 'error' | 'budget-blocked';
  provider?: string;
  model?: string;
  latencyMs?: number;
  message?: string;
}

export interface AiRuntimeUsageSummary {
  calls: number;
  healingCalls: number;
  reportingCalls: number;
  successfulCalls: number;
  noResultCalls: number;
  errorCalls: number;
  budgetBlockedCalls: number;
  averageLatencyMs: number;
  providers: Array<{ provider: string; calls: number; models: string[] }>;
  records: AiRuntimeAuditRecord[];
}

export interface HealingAuditRecord {
  runId?: string;
  testId?: string;
  timestamp: string;
  pageUrl: string;
  planId: string;
  businessName: string;
  decision: HealingDecision;
}

export interface HealingSummary {
  count: number;
  fallback: number;
  cache: number;
  ai: number;
  affectedTests: number;
  records: HealingAuditRecord[];
}

export interface BusinessImpactFact {
  tag: string;
  area: string;
  impact: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  affectedTests: number;
  testTitles: string[];
}

export interface FailureCluster {
  id: string;
  category: FailureCategory;
  signature: string;
  evidence: string;
  affectedTests: number;
  testTitles: string[];
}

export interface FlakySummary {
  flakyTests: number;
  retryRecovered: number;
  totalRetryAttempts: number;
  tests: Array<{
    testId: string;
    title: string;
    project: string;
    attempts: BusinessAttempt[];
  }>;
}

export interface QualityGate {
  status: 'PASSED' | 'ATTENTION_REQUIRED';
  passThreshold: number;
  highImpactFailures: number;
  reasons: string[];
}

export interface TestLayerSummary { UI: number; API: number; DATABASE: number; OTHER: number }
export type TestTypeSummary = Record<TestType, number>;

export interface ReportScope {
  includedTests: number;
  excludedInternalTests: number;
  internalTestsIncluded: boolean;
  description: string;
}

export interface ReportHistoryPoint {
  runId: string;
  generatedAt: string;
  environment: string;
  application: string;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  flaky: number;
  healed: number;
}

export interface ExecutionFacts {
  runId: string;
  environment: string;
  application: string;
  generatedAt: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  durationMs: number;
  healing: HealingSummary;
  aiUsage?: AiRuntimeUsageSummary;
  flakiness: FlakySummary;
  failureClusters: FailureCluster[];
  failureCategoryCounts: Record<string, number>;
  businessImpacts: BusinessImpactFact[];
  layerCounts: TestLayerSummary;
  testTypeCounts: TestTypeSummary;
  qualityGate: QualityGate;
  scope?: ReportScope;
  results: BusinessTestResult[];
}
