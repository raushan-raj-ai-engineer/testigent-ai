import type { FailureClassification, FailureConfidence, FailureIntelligenceCategory, FailureSignal } from './failure-intelligence.types.js';
import { buildFailureFingerprint } from './failure-fingerprint.js';
import { normalizeFailureText } from './failure-normalizer.js';

interface DeterministicDecision {
  category: FailureIntelligenceCategory;
  confidence: FailureConfidence;
  reasonCodes: string[];
  rationale: string;
  recommendation: string;
}

/**
 * Evidence-first root-cause classifier. It never converts ambiguous evidence into a product defect.
 */
export function classifyFailureDeterministically(signal: FailureSignal): FailureClassification {
  validateSignal(signal);
  const decision = decide(signal);
  const { fingerprint, normalizedSignature } = buildFailureFingerprint(signal);
  const evidenceMode = signal.evidenceMode ?? 'LIVE';
  const synthetic = evidenceMode === 'SHOWCASE' || signal.synthetic === true;
  const claimEligible = !synthetic && signal.claimEligible !== false && decision.category !== 'UNKNOWN' && decision.confidence !== 'INSUFFICIENT_EVIDENCE';
  const evidenceRefs = [signal.traceRef, signal.screenshotRef, signal.endpoint].filter((value): value is string => Boolean(value));
  return {
    scenarioId: signal.scenarioId,
    title: signal.title,
    application: signal.application,
    ...decision,
    fingerprint,
    normalizedSignature,
    evidenceRefs,
    evidenceMode,
    synthetic,
    claimEligible,
    aiEscalationAllowed: decision.category === 'UNKNOWN' && !synthetic,
    humanConfirmationRecommended: decision.category === 'UNKNOWN' || decision.confidence !== 'HIGH',
  };
}

function decide(signal: FailureSignal): DeterministicDecision {
  const error = normalizeFailureText(`${signal.error ?? ''} ${signal.consoleError ?? ''}`);
  const env = normalizeFailureText(signal.environmentSignal ?? '');
  const data = normalizeFailureText(signal.testDataSignal ?? '');
  const locator = normalizeFailureText(signal.locatorSignal ?? '');
  const contract = normalizeFailureText(signal.contractViolation ?? '');

  if (signal.knownDefectId) return result('KNOWN_DEFECT', 'HIGH', ['KNOWN_DEFECT_MATCH'], `Failure matches registered defect ${signal.knownDefectId}.`, 'Associate the occurrence with the registered defect; do not weaken the automated assertion.');
  if (signal.authStatus && signal.authStatus !== 'VALID') return result('AUTH_FAILURE', 'HIGH', [`AUTH_${signal.authStatus}`], `Authentication state is ${signal.authStatus.toLowerCase()} before the business action can be trusted.`, 'Repair or refresh authentication evidence before changing locators or product assertions.');
  if (contract) return result('API_CONTRACT_FAILURE', 'HIGH', ['OPENAPI_CONTRACT_VIOLATION'], `Declared API contract was violated: ${signal.contractViolation}.`, 'Treat the contract diff/response evidence as the primary triage path and confirm whether the service change is intentional.');
  if (env && /browser|runner|disk|certificate|environment|worker|resource|out of memory|oom/.test(env)) return result('ENVIRONMENT_FAILURE', 'HIGH', ['ENVIRONMENT_SIGNAL'], `Execution environment reported: ${signal.environmentSignal}.`, 'Repair the execution environment and rerun the affected scope without weakening test policy.');
  if (/upstream|dependency|gateway|connection refused|dns|socket/.test(`${error} ${env}`)) return result('DEPENDENCY_FAILURE', 'HIGH', ['DEPENDENCY_UNAVAILABLE'], 'Evidence indicates an unavailable or failing upstream dependency.', 'Route to the dependency/service owner and correlate affected scenarios by this fingerprint.');
  if (data || /duplicate key|invalid test data|fixture data|missing required test data/.test(error)) return result('TEST_DATA_FAILURE', 'HIGH', ['TEST_DATA_SIGNAL'], `Test data evidence is invalid or conflicting${signal.testDataSignal ? `: ${signal.testDataSignal}` : '.'}`, 'Repair isolated test data ownership/setup; do not classify as an application defect until valid input is proven.');
  if (locator || /strict mode|locator|element not found|waiting for selector|no element/.test(error)) {
    const rejected = signal.healingOutcome === 'REJECTED';
    return result('AUTOMATION_DEFECT', rejected ? 'HIGH' : 'MEDIUM', [rejected ? 'LOCATOR_RECOVERY_REJECTED' : 'LOCATOR_FAILURE'], 'UI interaction evidence points to an automation/locator problem rather than proven business behavior.', 'Review the page/facade locator contract and semantic post-condition; do not auto-promote an unverified heal.');
  }
  if (signal.flaky === true || (signal.retriesUsed ?? 0) > 0 && /timeout|intermittent|transient/.test(error)) return result('FLAKY_BEHAVIOR', 'MEDIUM', ['RETRY_VARIANCE'], 'Outcome varies across attempts and does not yet prove a stable product defect.', 'Correlate attempt evidence and timing; fix the instability source instead of adding blind retries.');
  if ((signal.httpStatus ?? 0) >= 500 && signal.authStatus === 'VALID') return result('PRODUCT_DEFECT', 'HIGH', ['BUSINESS_REQUEST_REACHED_PRODUCT', 'HTTP_5XX'], `Authenticated business request reached the application and returned HTTP ${signal.httpStatus}.`, 'Raise or associate a product defect with the request/response evidence; do not change locator/retry policy.');
  if (signal.businessStep?.trim() && hasBusinessAssertionEvidence(error)) return result('PRODUCT_DEFECT', 'MEDIUM', ['BUSINESS_ASSERTION_FAILED'], 'Business assertion failed after an identified business step reached application verification.', 'Validate the requirement and application behavior, then raise a product defect if the requirement remains authoritative.');
  return result('UNKNOWN', 'INSUFFICIENT_EVIDENCE', ['INSUFFICIENT_EVIDENCE'], 'Available evidence is insufficient for a trustworthy root-cause classification.', 'Collect trace, network, console, authentication and business-step evidence; keep the incident UNKNOWN until evidence improves.');
}

function hasBusinessAssertionEvidence(error: string): boolean {
  const explicitAssertion = /\b(?:assert|assertion)\b/.test(error);
  const expectedVsReceived = /\bexpected\b/.test(error) && /\breceived\b/.test(error);
  const semanticMismatch = /\b(?:business rule|incorrect total|wrong state|validation failed)\b/.test(error);
  return explicitAssertion || expectedVsReceived || semanticMismatch;
}

function result(category: FailureIntelligenceCategory, confidence: FailureConfidence, reasonCodes: string[], rationale: string, recommendation: string): DeterministicDecision {
  return { category, confidence, reasonCodes, rationale, recommendation };
}

function validateSignal(signal: FailureSignal): void {
  for (const [field, value] of [['scenarioId', signal.scenarioId], ['title', signal.title], ['application', signal.application]] as const) {
    if (!value?.trim()) throw new Error(`FAILURE_INTELLIGENCE_INVALID_SIGNAL: ${field} is required.`);
  }
  if (signal.evidenceMode === 'SHOWCASE' && signal.claimEligible === true) throw new Error('SHOWCASE_CLAIM_BOUNDARY: showcase evidence can never be claim-eligible.');
  if (signal.synthetic === true && signal.claimEligible === true) throw new Error('SYNTHETIC_CLAIM_BOUNDARY: synthetic evidence can never be claim-eligible.');
}
