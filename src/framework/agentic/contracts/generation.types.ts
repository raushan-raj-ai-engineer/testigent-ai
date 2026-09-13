import type {
  AgentEvidenceReference,
  AgenticOperationalState,
} from './agent.types';

/**
 * Artifact categories that the generator may propose.
 */
export type GeneratedArtifactKind =
  | 'test'
  | 'page-object'
  | 'api-client'
  | 'fixture'
  | 'test-data';

/**
 * Framework artifact proposed by the generator.
 *
 * Generation does not imply trust. A proposal must pass deterministic
 * review before it can be promoted to trusted framework evidence.
 */
export interface GenerationProposal {
  id: string;

  project: string;

  kind: GeneratedArtifactKind;

  targetPath: string;

  state: AgenticOperationalState;

  rationale: string;

  confidence: number | null;

  duplicateDetected: boolean;

  evidence: readonly AgentEvidenceReference[];

  content: string;
}
