/**
 * Author: Raushan Raj
 * Business Use: Shared deterministic reporting contracts for business, engineering, dashboard and AI layers.
 * How to use: Reporter records BusinessTestResult and structured test steps; analytics utilities derive ExecutionFacts.
 * Benefit: Business metrics remain deterministic while users can drill from executive KPIs into exact test-step evidence.
 */
import type { FailureCategory } from '../ai/failure.classifier';
import type { HealingDecision, HealingOutcome, HealingVerificationEvidence } from '../healing/healing.types';

export type TestLayer = 'UI' | 'API' | 'DATABASE';

export type BusinessOutcome =
  | 'PASSED'
  | 'PASSED_WITH_HEALING'
  | 'PASSED_AFTER_RETRY'
  | 'KNOWN_DEFECT'
  | 'FAILED'
  | 'SKIPPED'
  | 'UNEXPECTED_PASS';

export interface KnownDefectFact {
  id: string;
  title: string;
  scope?: string;
  note?: string;
}

export interface BusinessOutcomeSummary {
  cleanPassed: number;
  passedWithHealing: number;
  passedAfterRetry: number;
  knownDefects: number;
  unexpectedFailed: number;
  unexpectedPass: number;
  skipped: number;
  qualityPassed: number;
  qualityFailed: number;
  ciBlockingIssues: number;
  acceptedDefectDebt: number;
  toInvestigate: number;
  qualityPassRate: number;
}
export type TestType =
  | 'UI_ONLY'
  | 'API_ONLY'
  | 'DATABASE_ONLY'
  | 'UI_API'
  | 'UI_DATABASE'
  | 'API_DATABASE'
  | 'UI_API_DATABASE'
  | 'OTHER';

export type SkipCategory =
  | 'OPTIONAL_DEMO_DISABLED'
  | 'DATABASE_NOT_CONFIGURED'
  | 'HUMAN_REVIEW_PENDING'
  | 'AUTH_NOT_CONFIGURED'
  | 'DEPENDENCY_NOT_CONFIGURED'
  | 'OTHER';

export type SkipDisposition = 'NOT_APPLICABLE' | 'BLOCKED' | 'INTENTIONAL';

export interface SkipCategoryFact {
  category: SkipCategory;
  label: string;
  disposition: SkipDisposition;
  count: number;
  testTitles: string[];
  reasons: string[];
}

export interface SkipSummary {
  count: number;
  categories: SkipCategoryFact[];
}

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
  outcome?: BusinessOutcome;
  qualityStatus?: 'PASS' | 'FAIL' | 'NEUTRAL';
  ciBlocking?: boolean;
  knownDefect?: KnownDefectFact;
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
  skipReason?: string;
  skipCategory?: SkipCategory;
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
  /** Missing on pre-v1.2.2 records; reporting treats those historical records as validated. */
  outcome?: HealingOutcome;
  verification?: HealingVerificationEvidence;
  decision: HealingDecision;
}

export interface HealingSummary {
  /** Semantically validated recoveries only. */
  count: number;
  fallback: number;
  cache: number;
  ai: number;
  affectedTests: number;
  /** Validated recoveries used for PASSED WITH HEALING and release KPIs. */
  records: HealingAuditRecord[];
  /** Every audit attempt, including rejected/suggested/unverified evidence. */
  attempts: HealingAuditRecord[];
  attemptCount: number;
  rejected: number;
  suggested: number;
  unverified: number;
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
  status: 'PASSED' | 'PASSED_WITH_ACCEPTED_RISK' | 'ATTENTION_REQUIRED';
  passThreshold: number;
  highImpactFailures: number;
  reasons: string[];
}

export interface TestLayerSummary { UI: number; API: number; DATABASE: number; OTHER: number }
export type TestTypeSummary = Record<TestType, number>;

export interface ReportScope {
  /** Business scenarios selected by the Playwright run and included in stakeholder reporting. */
  includedTests: number;
  /** Scenarios that are applicable for the selected project/environment after capability policy. */
  applicableTests?: number;
  /** Scenarios intentionally not applicable (for example optional DB capability disabled). */
  notApplicableTests?: number;
  /** Applicable scenarios that did not execute because a prerequisite/review/dependency blocked them. */
  blockedTests?: number;
  /** Framework/internal checks excluded from stakeholder metrics. */
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
  qualityPassRate?: number;
  qualityFailed?: number;
  knownDefects?: number;
  unexpectedFailed?: number;
  executed?: number;
  applicable?: number;
  notApplicable?: number;
  blockedSkipped?: number;
}



export interface ReportAggregation {
  mode: 'single' | 'merged';
  sourceReports: number;
  sourceRunIds: string[];
  sourceDirectories?: string[];
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
  outcomes: BusinessOutcomeSummary;
  knownDefects: number;
  unexpectedFailed: number;
  unexpectedPass: number;
  qualityFailed: number;
  ciBlockingIssues: number;
  qualityPassRate: number;
  executed: number;
  /** Applicable execution denominator (selected minus not-applicable scenarios). */
  executionEligible: number;
  /** Business execution coverage: executed / applicable. */
  executionRate: number;
  notApplicable: number;
  blockedSkipped: number;
  executedPassRate: number;
  passRate: number;
  skipBreakdown: SkipSummary;
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
  aggregation?: ReportAggregation;
}
