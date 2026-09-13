import type {
  AgentEvidenceReference,
  AgenticOperationalState,
} from './agent.types';

/**
 * Supported test execution lanes for agentic planning.
 */
export const AGENTIC_TEST_LANES = [
  'ui',
  'api',
  'data',
  'db',
  'mixed',
] as const;

/**
 * Test lane selected by the planner.
 */
export type AgenticTestLane =
  (typeof AGENTIC_TEST_LANES)[number];

/**
 * Scenario proposed by the planner.
 */
export interface PlannedScenario {
  id: string;

  title: string;

  lane: AgenticTestLane;

  rationale: string;

  evidence: readonly AgentEvidenceReference[];
}

/**
 * Structured planner output.
 */
export interface TestPlanProposal {
  project: string;

  requirementRef: string;

  state: AgenticOperationalState;

  rationale: string;

  confidence: number | null;

  scenarios: readonly PlannedScenario[];

  evidence: readonly AgentEvidenceReference[];
}
