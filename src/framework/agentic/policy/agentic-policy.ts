import type {
  AgenticOperationalState,
} from '../contracts/agent.types';

/**
 * Inputs used by the deterministic TestigentAI agentic trust boundary.
 */
export interface AgenticPolicyInput {
  hasProvenance: boolean;

  evidenceCount: number;

  policyViolationCount: number;

  deterministicValidationPassed: boolean;

  confidence: number | null;

  minimumConfidence?: number;
}

/**
 * Result of deterministic agentic policy evaluation.
 */
export interface AgenticPolicyResult {
  state: AgenticOperationalState;

  trusted: boolean;

  reason: string;
}

const DEFAULT_MINIMUM_CONFIDENCE = 0.75;

/**
 * Evaluates whether an agentic proposal may cross the TestigentAI trust boundary.
 *
 * This decision is deterministic and does not invoke an AI provider.
 */
export function evaluateAgenticPolicy(
  input: AgenticPolicyInput,
): AgenticPolicyResult {
  if (!input.hasProvenance || input.evidenceCount <= 0) {
    return {
      state: 'INSUFFICIENT_EVIDENCE',
      trusted: false,
      reason: 'Agentic output does not contain sufficient provenance or evidence.',
    };
  }

  if (input.policyViolationCount > 0) {
    return {
      state: 'REJECTED',
      trusted: false,
      reason: 'Agentic output violates one or more deterministic framework policies.',
    };
  }

  if (!input.deterministicValidationPassed) {
    return {
      state: 'REVIEW_REQUIRED',
      trusted: false,
      reason: 'Deterministic validation has not approved the agentic output.',
    };
  }

  const minimumConfidence =
    input.minimumConfidence ?? DEFAULT_MINIMUM_CONFIDENCE;

  if (
    input.confidence !== null &&
    (
      !Number.isFinite(input.confidence) ||
      input.confidence < minimumConfidence
    )
  ) {
    return {
      state: 'REVIEW_REQUIRED',
      trusted: false,
      reason: 'Agent confidence is below the configured trust threshold.',
    };
  }

  return {
    state: 'ACCEPTED',
    trusted: true,
    reason: 'Agentic output passed deterministic trust-boundary checks.',
  };
}

/**
 * Returns true only when an operational state represents trusted evidence.
 */
export function canPromoteToTrustedEvidence(
  state: AgenticOperationalState,
): boolean {
  return state === 'ACCEPTED';
}
