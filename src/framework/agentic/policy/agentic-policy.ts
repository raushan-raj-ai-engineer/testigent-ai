import type { AgenticOperationalState } from '../contracts/agent.types.js';

export interface AgenticPolicyInput {
  hasProvenance: boolean;
  evidenceCount: number;
  policyViolationCount: number;
  deterministicValidationPassed: boolean;
  confidence: number | null;
  minimumConfidence?: number;
  requiresConfidence?: boolean;
  humanApprovalRequired?: boolean;
  humanApproved?: boolean;
  providerDegraded?: boolean;
}

export interface AgenticPolicyResult {
  state: AgenticOperationalState;
  trusted: boolean;
  reason: string;
}

const DEFAULT_MINIMUM_CONFIDENCE = 0.75;

/** Deterministically decides whether an agentic result may cross the TestigentAI trust boundary. */
export function evaluateAgenticPolicy(input: AgenticPolicyInput): AgenticPolicyResult {
  if (!input.hasProvenance || input.evidenceCount <= 0) {
    return { state: 'INSUFFICIENT_EVIDENCE', trusted: false, reason: 'Agentic output does not contain sufficient provenance or evidence.' };
  }
  if (input.policyViolationCount > 0) {
    return { state: 'REJECTED', trusted: false, reason: 'Agentic output violates one or more deterministic framework policies.' };
  }
  if (!input.deterministicValidationPassed) {
    return { state: 'REVIEW_REQUIRED', trusted: false, reason: 'Deterministic validation has not approved the agentic output.' };
  }
  if (input.providerDegraded) {
    return { state: 'DEGRADED', trusted: false, reason: 'Live provider evidence is degraded and cannot be promoted as trusted agentic evidence.' };
  }
  const minimumConfidence = input.minimumConfidence ?? DEFAULT_MINIMUM_CONFIDENCE;
  if (input.requiresConfidence && input.confidence === null) {
    return { state: 'REVIEW_REQUIRED', trusted: false, reason: 'A confidence value is required before this agentic output can be trusted.' };
  }
  if (input.confidence !== null && (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1 || input.confidence < minimumConfidence)) {
    return { state: 'REVIEW_REQUIRED', trusted: false, reason: 'Agent confidence is outside the accepted range or below the configured trust threshold.' };
  }
  if (input.humanApprovalRequired && !input.humanApproved) {
    return { state: 'REVIEW_REQUIRED', trusted: false, reason: 'Human approval is required before this agentic output may become trusted evidence.' };
  }
  return { state: 'ACCEPTED', trusted: true, reason: 'Agentic output passed deterministic trust-boundary checks.' };
}

/** Returns true only for the single state allowed to become trusted evidence. */
export function canPromoteToTrustedEvidence(state: AgenticOperationalState): boolean {
  return state === 'ACCEPTED';
}
