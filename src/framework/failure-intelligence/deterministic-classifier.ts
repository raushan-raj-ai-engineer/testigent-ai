import type { FailureClassification, FailureConfidence, FailureIntelligenceCategory, FailureSignal } from './failure-intelligence.types.js';
import { buildFailureFingerprint, buildIncidentFingerprint } from './failure-fingerprint.js';
import { normalizeFailureText } from './failure-normalizer.js';
import { redact, sanitizeText, sanitizeUrl } from '../logging/redactor.js';

interface DeterministicDecision { category: FailureIntelligenceCategory; confidence: FailureConfidence; reasonCodes: string[]; rationale: string; recommendation: string; }

/** Evidence-first root-cause classifier. Ambiguous symptoms abstain instead of being upgraded into root-cause claims. */
export function classifyFailureDeterministically(input: FailureSignal): FailureClassification {
  validateSignal(input);
  const signal = sanitizeSignal(input);
  let decision = decide(signal);
  const evidenceMode = signal.evidenceMode ?? 'UNVERIFIED';
  const synthetic = evidenceMode === 'SHOWCASE' || signal.synthetic === true;
  if (evidenceMode === 'UNVERIFIED' && decision.confidence !== 'INSUFFICIENT_EVIDENCE') {
    decision = { ...decision, confidence: 'LOW', reasonCodes: [...decision.reasonCodes, 'UNVERIFIED_PROVENANCE'] };
  }
  const symptom = buildFailureFingerprint(signal);
  const fingerprint = buildIncidentFingerprint(signal, decision.category, decision.reasonCodes, symptom.fingerprint);
  const trustedLive = evidenceMode === 'LIVE' && synthetic === false && signal.claimEligible === true;

  // Heuristic interpretation may improve triage routing, but it is not
  // structured producer evidence and must never become claim-eligible.
  const heuristicOnly = decision.reasonCodes.some(code => code.startsWith('HEURISTIC_'));

  const claimEligible =
    trustedLive &&
    !heuristicOnly &&
    decision.category !== 'UNKNOWN' &&
    decision.confidence !== 'INSUFFICIENT_EVIDENCE';
  const evidenceRefs = [signal.traceRef, signal.screenshotRef, signal.endpoint].filter((value): value is string => Boolean(value)).map(sanitizeReference);
  const result: FailureClassification = {
    scenarioId: sanitizeText(signal.scenarioId, { redactPii: true }), title: sanitizeText(signal.title, { redactPii: true }), application: sanitizeText(signal.application, { redactPii: true }),
    ...decision, fingerprint, symptomFingerprint: symptom.fingerprint, normalizedSignature: symptom.normalizedSignature,
    evidenceRefs, evidenceMode, synthetic, claimEligible,
    aiEscalationAllowed: decision.category === 'UNKNOWN' && !synthetic,
    humanConfirmationRecommended: decision.category === 'UNKNOWN' || decision.confidence !== 'HIGH' || !claimEligible,
  };
  // Final public-boundary redaction protects MCP, reporting and persistence
  // even if an upstream adapter missed a field.
  const redacted = redact(result, { redactPii: true }) as FailureClassification;

  // The final structured redactor intentionally emits uppercase security
  // placeholders. normalizedSignature is a canonical fingerprint surface,
  // so normalize those placeholders after the final redaction pass.
  return {
    ...redacted,
    normalizedSignature: canonicalizeNormalizedSignature(redacted.normalizedSignature),
  };
}

function canonicalizeNormalizedSignature(value: string): string {
  return value
    .replace(/\[REDACTED\]/g, '[redacted]')
    .replace(/\[TOKEN_REDACTED\]/g, '[token_redacted]')
    .replace(/\[EMAIL_REDACTED\]/g, '[email_redacted]')
    .replace(/\[NUMBER_REDACTED\]/g, '[number_redacted]');
}

function decide(signal: FailureSignal): DeterministicDecision {
  const error = normalizeFailureText(`${signal.error ?? ''} ${signal.consoleError ?? ''}`);
  const env = normalizeFailureText(signal.environmentSignal ?? '');
  const dependency = normalizeFailureText(signal.dependencySignal ?? '');
  const data = normalizeFailureText(signal.testDataSignal ?? '');
  const locator = normalizeFailureText(signal.locatorSignal ?? '');
  const contract = normalizeFailureText(signal.contractViolation ?? '');

  if (signal.knownDefectId) return result('KNOWN_DEFECT', 'HIGH', ['KNOWN_DEFECT_MATCH'], `Failure matches registered defect ${signal.knownDefectId}.`, 'Associate the occurrence with the registered defect; do not weaken the automated assertion.');
  if (signal.authStatus && signal.authStatus !== 'VALID') return result('AUTH_FAILURE', 'HIGH', [`AUTH_${signal.authStatus}`], `Authentication state is ${signal.authStatus.toLowerCase()} before the business action can be trusted.`, 'Repair or refresh authentication evidence before changing locators or product assertions.');
  if (contract) return result('API_CONTRACT_FAILURE', 'HIGH', ['OPENAPI_CONTRACT_VIOLATION'], `Declared API contract was violated: ${signal.contractViolation}.`, 'Treat the contract diff/response evidence as the primary triage path and confirm whether the service change is intentional.');
  if (env && /browser|runner|disk|certificate|environment|worker|resource|out of memory|oom/.test(env)) return result('ENVIRONMENT_FAILURE', 'HIGH', ['ENVIRONMENT_SIGNAL'], `Execution environment reported: ${signal.environmentSignal}.`, 'Repair the execution environment and rerun the affected scope without weakening test policy.');
  if (dependency) return result('DEPENDENCY_FAILURE', 'HIGH', ['DEPENDENCY_SIGNAL'], `Structured dependency evidence reported: ${signal.dependencySignal}.`, 'Route to the dependency/service owner and correlate affected scenarios by incident identity.');
  if (data) return result('TEST_DATA_FAILURE', 'HIGH', ['TEST_DATA_SIGNAL'], `Structured test-data evidence is invalid or conflicting: ${signal.testDataSignal}.`, 'Repair isolated test data ownership/setup; do not classify as an application defect until valid input is proven.');
  if (locator) {
    const rejected = signal.healingOutcome === 'REJECTED';
    return result('AUTOMATION_DEFECT', 'MEDIUM', [rejected ? 'LOCATOR_RECOVERY_REJECTED' : 'LOCATOR_SIGNAL'], 'Structured UI interaction evidence suggests an automation/locator issue; product ownership is not proven.', 'Review the page/facade locator contract and semantic post-condition; do not auto-promote an unverified heal.');
  }
  if (signal.flaky === true || ((signal.retriesUsed ?? 0) > 0 && /timeout|intermittent|transient/.test(error))) return result('FLAKY_BEHAVIOR', 'MEDIUM', ['RETRY_VARIANCE'], 'Outcome varies across attempts and does not yet prove a stable product defect.', 'Correlate attempt evidence and timing; fix the instability source instead of adding blind retries.');

  // A 5xx mentioning an upstream/downstream/gateway/dependency is useful
  // deterministic triage evidence, but text alone is still heuristic.
  // Route it as a dependency suspicion at LOW confidence and keep it
  // non-claimable until structured dependency/trace evidence confirms it.
  if (
    (signal.httpStatus ?? 0) >= 500 &&
    /\b(?:upstream|downstream|gateway|dependency)\b/.test(error) &&
    /\b(?:service unavailable|bad gateway|gateway timeout|connection refused|connection reset|upstream)\b/.test(error)
  ) {
    return result(
      'DEPENDENCY_FAILURE',
      'LOW',
      ['HEURISTIC_UPSTREAM_DEPENDENCY'],
      'Failure text indicates a likely upstream dependency or gateway failure, but structured dependency ownership evidence is not present.',
      'Correlate trace/network evidence and confirm the dependency owner before treating this triage classification as authoritative.',
    );
  }

  if ((signal.httpStatus ?? 0) >= 500 && signal.authStatus === 'VALID' && Boolean(signal.endpoint) && Boolean(signal.traceRef)) return result('PRODUCT_DEFECT', 'MEDIUM', ['BUSINESS_REQUEST_REACHED_PRODUCT', 'HTTP_5XX', 'REQUEST_TRACE_PRESENT'], `Authenticated request with trace evidence returned HTTP ${signal.httpStatus}.`, 'Confirm service ownership and request/response evidence, then associate a product defect if application behavior is authoritative.');
  if (signal.businessStep?.trim() && hasBusinessAssertionEvidence(error)) return result('PRODUCT_DEFECT', 'MEDIUM', ['BUSINESS_ASSERTION_FAILED'], 'Business assertion failed after an identified business step reached application verification.', 'Validate the requirement and application behavior, then raise a product defect if the requirement remains authoritative.');

  const heuristicCodes: string[] = [];
  if (signal.legacyCategoryHint) heuristicCodes.push(`LEGACY_HEURISTIC_${signal.legacyCategoryHint}`);
  if (/strict mode|locator|element not found|waiting for selector|no element/.test(error)) heuristicCodes.push('HEURISTIC_LOCATOR_SYMPTOM');
  if (/openapi|contract|schema/.test(error)) heuristicCodes.push('HEURISTIC_CONTRACT_TEXT');
  if ((signal.httpStatus ?? 0) >= 500) heuristicCodes.push('HTTP_5XX_WITHOUT_PROVENANCE');
  return result('UNKNOWN', 'INSUFFICIENT_EVIDENCE', ['INSUFFICIENT_EVIDENCE', ...heuristicCodes], 'Available evidence is insufficient for a trustworthy root-cause classification.', 'Collect structured trace, network, authentication, contract and business-step evidence; keep the incident UNKNOWN until provenance improves.');
}

function hasBusinessAssertionEvidence(error: string): boolean { return /\b(?:assert|assertion)\b/.test(error) || (/\bexpected\b/.test(error) && /\breceived\b/.test(error)) || /\b(?:business rule|incorrect total|wrong state|validation failed)\b/.test(error); }
function result(category: FailureIntelligenceCategory, confidence: FailureConfidence, reasonCodes: string[], rationale: string, recommendation: string): DeterministicDecision { return { category, confidence, reasonCodes, rationale: sanitizeText(rationale, { redactPii: true }), recommendation: sanitizeText(recommendation, { redactPii: true }) }; }
function sanitizeReference(value: string): string { return /^https?:\/\//i.test(value) ? sanitizeUrl(value, { redactPii: true }) : sanitizeText(value, { redactPii: true }); }
function sanitizeSignal(signal: FailureSignal): FailureSignal {
  const cleaned = redact(signal, { redactPii: true }) as FailureSignal;
  return { ...cleaned, endpoint: cleaned.endpoint ? sanitizeUrl(cleaned.endpoint, { redactPii: true }) : undefined, traceRef: cleaned.traceRef ? sanitizeReference(cleaned.traceRef) : undefined, screenshotRef: cleaned.screenshotRef ? sanitizeReference(cleaned.screenshotRef) : undefined };
}
function validateSignal(signal: FailureSignal): void {
  for (const [field, value] of [['scenarioId', signal.scenarioId], ['title', signal.title], ['application', signal.application]] as const) if (!value?.trim()) throw new Error(`FAILURE_INTELLIGENCE_INVALID_SIGNAL: ${field} is required.`);
  if (signal.evidenceMode === 'SHOWCASE' && signal.claimEligible === true) throw new Error('SHOWCASE_CLAIM_BOUNDARY: showcase evidence can never be claim-eligible.');
  if (signal.evidenceMode === 'UNVERIFIED' && signal.claimEligible === true) throw new Error('UNVERIFIED_CLAIM_BOUNDARY: caller/unverified evidence can never be claim-eligible.');
  if (signal.synthetic === true && signal.claimEligible === true) throw new Error('SYNTHETIC_CLAIM_BOUNDARY: synthetic evidence can never be claim-eligible.');
}
