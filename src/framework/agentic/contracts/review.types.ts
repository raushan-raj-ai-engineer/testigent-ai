import type { AgentEvidenceReference, AgenticOperationalState } from './agent.types.js';

export type ReviewFindingSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ReviewFinding {
  ruleId: string;
  severity: ReviewFindingSeverity;
  message: string;
  evidence: AgentEvidenceReference[];
}

export interface AgenticReviewResult {
  version: 1;
  proposalId: string;
  state: AgenticOperationalState;
  deterministicValidationPassed: boolean;
  requiresHumanApproval: boolean;
  findings: ReviewFinding[];
  rationale: string;
}
