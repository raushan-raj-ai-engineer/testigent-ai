/** Agentic operational states surfaced consistently across planner, generator, reviewer, MCP and reporting. */
export const AGENTIC_OPERATIONAL_STATES = [
  'ACCEPTED',
  'REJECTED',
  'REVIEW_REQUIRED',
  'INSUFFICIENT_EVIDENCE',
  'SKIPPED',
  'DEGRADED',
] as const;

export type AgenticOperationalState = (typeof AGENTIC_OPERATIONAL_STATES)[number];
export type AgentKind = 'planner' | 'generator' | 'reviewer' | 'healer' | 'mcp';
export type AgentEvidenceKind = 'requirement' | 'scenario' | 'test' | 'source' | 'execution' | 'defect' | 'healing' | 'policy' | 'external';

export interface AgentEvidenceReference {
  kind: AgentEvidenceKind;
  ref: string;
  description?: string;
  digest?: string;
}

export interface AgentDecisionRecord {
  version: 1;
  id: string;
  runId: string;
  application: string;
  environment: string;
  timestamp: string;
  agent: AgentKind;
  operation: string;
  state: AgenticOperationalState;
  rationale: string;
  confidence: number | null;
  policyPassed: boolean;
  deterministicValidationPassed: boolean;
  humanApprovalRequired: boolean;
  humanApproved: boolean;
  inputDigest?: string;
  provider?: string;
  model?: string;
  evidence: AgentEvidenceReference[];
  affectedArtifacts: string[];
}

export interface AgentDecisionInput extends Omit<AgentDecisionRecord, 'version' | 'id' | 'timestamp'> {
  id?: string;
  timestamp?: string;
}
