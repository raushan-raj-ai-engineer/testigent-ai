import { createHash } from 'node:crypto';
import type { GenerationProposal, GenerationProposalInput } from '../contracts/generation.types.js';
import { detectGenerationDuplicate } from './duplicate-detector.js';
import { assertAgenticTargetPath, assertSafeProjectName } from '../policy/path-policy.js';

/** Creates a review-first generation proposal without writing generated code into project source. */
export function createGenerationProposal(root: string, input: GenerationProposalInput): GenerationProposal {
  assertSafeProjectName(input.project);
  const targetPath = assertAgenticTargetPath(root, input.project, input.targetPath);
  if (!input.content.trim()) throw new Error('Agentic generation proposal content cannot be empty.');
  if (input.content.length > 250_000) throw new Error('Agentic generation proposal exceeds the 250000 character safety limit.');
  const duplicate = detectGenerationDuplicate(root, input.project, targetPath, input.content);
  const contentSha256 = createHash('sha256').update(input.content).digest('hex');
  const idSeed = `${input.planId}\n${input.requirementRef}\n${input.project}\n${targetPath}\n${contentSha256}`;
  return {
    version: 1,
    id: `proposal-${createHash('sha256').update(idSeed).digest('hex').slice(0, 20)}`,
    planId: input.planId,
    requirementRef: input.requirementRef,
    project: input.project,
    kind: input.kind,
    targetPath,
    state: duplicate.duplicate ? 'REJECTED' : 'REVIEW_REQUIRED',
    rationale: duplicate.reason ?? input.rationale,
    confidence: input.confidence,
    duplicateDetected: duplicate.duplicate,
    contentSha256,
    content: input.content,
    evidence: [
      { kind: 'requirement', ref: input.requirementRef },
      { kind: 'policy', ref: input.planId, description: 'Agentic plan provenance.' },
      ...(input.evidence ?? []),
    ],
    ...(input.provider ? { provider: input.provider } : {}),
    ...(input.model ? { model: input.model } : {}),
  };
}
