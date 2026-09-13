import type { AgentEvidenceReference, AgenticOperationalState } from './agent.types.js';

export type GeneratedArtifactKind = 'test' | 'page-object' | 'api-client' | 'fixture' | 'test-data';

export interface GenerationProposal {
  version: 1;
  id: string;
  planId: string;
  requirementRef: string;
  project: string;
  kind: GeneratedArtifactKind;
  targetPath: string;
  state: AgenticOperationalState;
  rationale: string;
  confidence: number | null;
  duplicateDetected: boolean;
  contentSha256: string;
  content: string;
  evidence: AgentEvidenceReference[];
  provider?: string;
  model?: string;
}

export interface GenerationProposalInput {
  planId: string;
  requirementRef: string;
  project: string;
  kind: GeneratedArtifactKind;
  targetPath: string;
  content: string;
  rationale: string;
  confidence: number | null;
  evidence?: AgentEvidenceReference[];
  provider?: string;
  model?: string;
}
