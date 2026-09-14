import { createHash } from 'node:crypto';
import type { FailureIntelligenceCategory, FailureSignal } from './failure-intelligence.types.js';
import { normalizeEndpoint, normalizeFailureText } from './failure-normalizer.js';

/** Builds a deterministic symptom signature from stable evidence rather than volatile run ids. */
export function buildFailureFingerprint(signal: FailureSignal): { fingerprint: string; normalizedSignature: string } {
  const normalizedSignature = [
    `step=${normalizeFailureText(signal.businessStep ?? '')}`,
    `error=${normalizeFailureText(signal.error ?? '')}`,
    `endpoint=${normalizeEndpoint(signal.endpoint ?? '')}`,
    `status=${Number.isInteger(signal.httpStatus) ? signal.httpStatus : ''}`,
    `contract=${normalizeFailureText(signal.contractViolation ?? '')}`,
    `auth=${signal.authStatus ?? ''}`,
    `environment=${normalizeFailureText(signal.environmentSignal ?? '')}`,
    `dependency=${normalizeFailureText(signal.dependencySignal ?? '')}`,
    `data=${normalizeFailureText(signal.testDataSignal ?? '')}`,
    `locator=${normalizeFailureText(signal.locatorSignal ?? '')}`,
  ].join('|');
  return { fingerprint: digest(normalizedSignature), normalizedSignature };
}

/** Cause-aware incident identity. Contradictory categories never inherit whichever classification was seen first. */
export function buildIncidentFingerprint(signal: FailureSignal, category: FailureIntelligenceCategory, reasonCodes: string[], symptomFingerprint: string): string {
  const scope = [
    `symptom=${symptomFingerprint}`,
    `category=${category}`,
    `reason=${[...reasonCodes].sort().join('+')}`,
    `application=${normalizeFailureText(signal.application)}`,
  ].join('|');
  return digest(scope);
}
function digest(value: string): string { return createHash('sha256').update(value).digest('hex').slice(0, 16); }
