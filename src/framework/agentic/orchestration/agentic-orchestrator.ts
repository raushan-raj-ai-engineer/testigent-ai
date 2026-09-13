import { createHash } from 'node:crypto';
import type { GenerationProposal, GenerationProposalInput } from '../contracts/generation.types.js';
import type { AgenticReviewResult } from '../contracts/review.types.js';
import type { AgentDecisionRecord } from '../contracts/agent.types.js';
import { createGenerationProposal } from '../generator/test-generator.js';
import { reviewGenerationProposal } from '../reviewer/generated-test-reviewer.js';
import { evaluateAgenticPolicy } from '../policy/agentic-policy.js';
import { AgentDecisionLedger } from '../evidence/agent-decision-ledger.js';

export interface AgenticGenerationOutcome {
  proposal: GenerationProposal;
  review: AgenticReviewResult;
  decision: AgentDecisionRecord;
}

/** Coordinates generation proposal, deterministic review, trust policy and immutable provenance without promoting source code. */
export function orchestrateGenerationProposal(
  root: string,
  ledger: AgentDecisionLedger,
  context: { runId: string; application: string; environment: string },
  input: GenerationProposalInput,
): AgenticGenerationOutcome {
  const proposal = createGenerationProposal(root, input);
  const review = reviewGenerationProposal(proposal);
  const blockingFindings = review.findings.filter(item => item.severity === 'critical' || item.severity === 'error').length;
  const policy = evaluateAgenticPolicy({
    hasProvenance: proposal.evidence.length > 0,
    evidenceCount: proposal.evidence.length,
    policyViolationCount: blockingFindings,
    deterministicValidationPassed: review.deterministicValidationPassed,
    confidence: proposal.confidence,
    requiresConfidence: Boolean(proposal.provider),
    humanApprovalRequired: true,
    humanApproved: false,
  });
  const inputDigest = createHash('sha256').update(JSON.stringify({ ...input, content: proposal.contentSha256 })).digest('hex');
  const decision = ledger.append({
    runId: context.runId,
    application: context.application,
    environment: context.environment,
    agent: 'reviewer',
    operation: 'review-generation-proposal',
    state: policy.state,
    rationale: `${review.rationale} ${policy.reason}`,
    confidence: proposal.confidence,
    policyPassed: blockingFindings === 0,
    deterministicValidationPassed: review.deterministicValidationPassed,
    humanApprovalRequired: true,
    humanApproved: false,
    inputDigest,
    ...(proposal.provider ? { provider: proposal.provider } : {}),
    ...(proposal.model ? { model: proposal.model } : {}),
    evidence: proposal.evidence,
    affectedArtifacts: [proposal.targetPath],
  });
  return { proposal, review, decision };
}
