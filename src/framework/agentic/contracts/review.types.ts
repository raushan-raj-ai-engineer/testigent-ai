import type {
  AgentEvidenceReference,
  AgenticOperationalState,
} from './agent.types';

/**
 * Severity assigned to an agentic review finding.
 */
export type ReviewFindingSeverity =
  | 'info'
  | 'warning'
  | 'error'
  | 'critical';

/**
 * Deterministic reviewer finding.
 */
export interface ReviewFinding {
  ruleId: string;

  severity: ReviewFindingSeverity;

  message: string;

  evidence: readonly AgentEvidenceReference[];
}

/**
 * Result produced by the deterministic agentic reviewer.
 */
export interface AgenticReviewResult {
  state: AgenticOperationalState;

  accepted: boolean;

  findings: readonly ReviewFinding[];

  rationale: string;
}
