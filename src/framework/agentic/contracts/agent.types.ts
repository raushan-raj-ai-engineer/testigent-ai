/**
 * Stable operational states used by TestigentAI agentic components.
 */
export const AGENTIC_OPERATIONAL_STATES = [
  'ACCEPTED',
  'REJECTED',
  'REVIEW_REQUIRED',
  'INSUFFICIENT_EVIDENCE',
  'SKIPPED',
  'DEGRADED',
] as const;

/**
 * Operational state emitted by an agentic decision.
 */
export type AgenticOperationalState =
  (typeof AGENTIC_OPERATIONAL_STATES)[number];

/**
 * Supported logical agent roles.
 */
export type AgentKind =
  | 'planner'
  | 'generator'
  | 'reviewer'
  | 'healer'
  | 'mcp';

/**
 * Evidence reference attached to an agentic decision.
 */
export interface AgentEvidenceReference {
  kind:
    | 'requirement'
    | 'scenario'
    | 'test'
    | 'source'
    | 'execution'
    | 'defect'
    | 'healing'
    | 'external';

  ref: string;

  description?: string;
}

/**
 * Auditable decision produced by an agentic component.
 */
export interface AgentDecisionRecord {
  agent: AgentKind;

  operation: string;

  state: AgenticOperationalState;

  rationale: string;

  confidence: number | null;

  policyPassed: boolean;

  deterministicValidationPassed: boolean;

  evidence: readonly AgentEvidenceReference[];

  affectedArtifacts: readonly string[];

  runId: string;

  timestamp: string;

  provider?: string;

  model?: string;
}
