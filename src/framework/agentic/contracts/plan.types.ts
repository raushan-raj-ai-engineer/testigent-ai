import type { AgentEvidenceReference, AgenticOperationalState } from './agent.types.js';

/** Stable lanes used by the agentic planner without replacing existing TestigentAI execution-layer contracts. */
export const AGENTIC_TEST_LANES = ['ui', 'api', 'database', 'mixed'] as const;
export type AgenticTestLane = (typeof AGENTIC_TEST_LANES)[number];

export interface PlannedScenario {
  id: string;
  title: string;
  lane: AgenticTestLane;
  rationale: string;
  reviewRequired: boolean;
  evidence: AgentEvidenceReference[];
}

export interface TestPlanProposal {
  version: 1;
  planId: string;
  project?: string;
  requirementRef: string;
  title: string;
  state: AgenticOperationalState;
  rationale: string;
  confidence: number | null;
  lanes: AgenticTestLane[];
  scenarios: PlannedScenario[];
  missingInformation: string[];
  conflicts: string[];
  evidence: AgentEvidenceReference[];
}

export interface AgenticImpactCandidate {
  testPath: string;
  score: number;
  reasons: string[];
}

export interface AgenticImpactResult {
  version: 1;
  project: string;
  state: AgenticOperationalState;
  changedPaths: string[];
  affectedTests: AgenticImpactCandidate[];
  rationale: string;
  evidence: AgentEvidenceReference[];
}
