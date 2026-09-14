/** Canonical deterministic failure categories used by classification, clustering and reporting. */
export const FAILURE_INTELLIGENCE_CATEGORIES = [
  'PRODUCT_DEFECT',
  'AUTOMATION_DEFECT',
  'ENVIRONMENT_FAILURE',
  'TEST_DATA_FAILURE',
  'AUTH_FAILURE',
  'API_CONTRACT_FAILURE',
  'DEPENDENCY_FAILURE',
  'FLAKY_BEHAVIOR',
  'KNOWN_DEFECT',
  'UNKNOWN',
] as const;

/** Supported deterministic root-cause category. */
export type FailureIntelligenceCategory = (typeof FAILURE_INTELLIGENCE_CATEGORIES)[number];
/** Evidence origin boundary separating live execution from customer showcase data. */
export type FailureEvidenceMode = 'LIVE' | 'SHOWCASE';
/** Explainable confidence state; insufficient evidence is represented explicitly instead of guessed. */
export type FailureConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_EVIDENCE';

/** Sanitized failure evidence presented to deterministic triage. */
export interface FailureSignal {
  scenarioId: string;
  title: string;
  application: string;
  project?: string;
  businessStep?: string;
  error?: string;
  endpoint?: string;
  httpStatus?: number;
  contractViolation?: string;
  authStatus?: 'VALID' | 'INVALID' | 'EXPIRED' | 'NOT_CONFIGURED';
  environmentSignal?: string;
  testDataSignal?: string;
  locatorSignal?: string;
  healingOutcome?: 'VALIDATED' | 'REJECTED' | 'SUGGESTED' | 'UNVERIFIED' | 'NONE';
  flaky?: boolean;
  retriesUsed?: number;
  knownDefectId?: string;
  consoleError?: string;
  traceRef?: string;
  screenshotRef?: string;
  evidenceMode?: FailureEvidenceMode;
  synthetic?: boolean;
  claimEligible?: boolean;
}

/** Deterministic classification plus its evidence, recommendation and trust metadata. */
export interface FailureClassification {
  scenarioId: string;
  title: string;
  application: string;
  category: FailureIntelligenceCategory;
  confidence: FailureConfidence;
  fingerprint: string;
  normalizedSignature: string;
  reasonCodes: string[];
  rationale: string;
  recommendation: string;
  evidenceRefs: string[];
  evidenceMode: FailureEvidenceMode;
  synthetic: boolean;
  claimEligible: boolean;
  aiEscalationAllowed: boolean;
  humanConfirmationRecommended: boolean;
}

/** Aggregated incident cluster for failures that share one stable fingerprint. */
export interface FailureClusterIntelligence {
  fingerprint: string;
  category: FailureIntelligenceCategory;
  affectedScenarios: number;
  applications: string[];
  scenarioIds: string[];
  titles: string[];
  confidence: FailureConfidence;
  recommendation: string;
}

/** Run-level failure intelligence used by reporting and governed MCP explanations. */
export interface FailureIntelligenceSummary {
  analyzedScenarios: number;
  uniqueIncidents: number;
  unknownScenarios: number;
  categories: Record<FailureIntelligenceCategory, number>;
  classifications: FailureClassification[];
  clusters: FailureClusterIntelligence[];
  evidenceMode: FailureEvidenceMode | 'MIXED';
  claimEligible: boolean;
  truthBoundary: string;
}
