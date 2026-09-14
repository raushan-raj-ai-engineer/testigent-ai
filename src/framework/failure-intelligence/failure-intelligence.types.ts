/** Canonical deterministic failure categories used by classification, clustering and reporting. */
export const FAILURE_INTELLIGENCE_CATEGORIES = [
  'PRODUCT_DEFECT','AUTOMATION_DEFECT','ENVIRONMENT_FAILURE','TEST_DATA_FAILURE','AUTH_FAILURE',
  'API_CONTRACT_FAILURE','DEPENDENCY_FAILURE','FLAKY_BEHAVIOR','KNOWN_DEFECT','UNKNOWN',
] as const;
export type FailureIntelligenceCategory = (typeof FAILURE_INTELLIGENCE_CATEGORIES)[number];
/** Evidence origin boundary. UNVERIFIED is mandatory for free-form/model/caller supplied evidence. */
export type FailureEvidenceMode = 'LIVE' | 'SHOWCASE' | 'UNVERIFIED';
export type FailureConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_EVIDENCE';

export interface FailureSignal {
  scenarioId: string; title: string; application: string; project?: string; businessStep?: string;
  error?: string; endpoint?: string; httpStatus?: number; contractViolation?: string;
  authStatus?: 'VALID' | 'INVALID' | 'EXPIRED' | 'NOT_CONFIGURED'; environmentSignal?: string; dependencySignal?: string;
  testDataSignal?: string; locatorSignal?: string;
  healingOutcome?: 'VALIDATED' | 'REJECTED' | 'SUGGESTED' | 'UNVERIFIED' | 'NONE';
  flaky?: boolean; retriesUsed?: number; knownDefectId?: string; consoleError?: string;
  traceRef?: string; screenshotRef?: string; evidenceMode?: FailureEvidenceMode; synthetic?: boolean; claimEligible?: boolean;
}

export interface FailureClassification {
  scenarioId: string; title: string; application: string; category: FailureIntelligenceCategory;
  confidence: FailureConfidence;
  /** Incident identity includes cause/category scope. */
  fingerprint: string;
  /** Symptom signature remains useful for cross-cause correlation without merging contradictory causes. */
  symptomFingerprint: string;
  normalizedSignature: string; reasonCodes: string[]; rationale: string; recommendation: string;
  evidenceRefs: string[]; evidenceMode: FailureEvidenceMode; synthetic: boolean; claimEligible: boolean;
  aiEscalationAllowed: boolean; humanConfirmationRecommended: boolean;
}

export interface FailureClusterIntelligence {
  fingerprint: string; category: FailureIntelligenceCategory; affectedScenarios: number; applications: string[];
  scenarioIds: string[]; titles: string[]; confidence: FailureConfidence; recommendation: string;
}

export interface FailureIntelligenceSummary {
  analyzedScenarios: number; uniqueIncidents: number; unknownScenarios: number;
  categories: Record<FailureIntelligenceCategory, number>; classifications: FailureClassification[];
  clusters: FailureClusterIntelligence[]; evidenceMode: FailureEvidenceMode | 'MIXED'; claimEligible: boolean; truthBoundary: string;
}
