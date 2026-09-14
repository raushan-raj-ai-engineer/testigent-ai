import { createHash } from 'node:crypto';
import type { FailureSignal } from './failure-intelligence.types.js';
import { normalizeEndpoint, normalizeFailureText } from './failure-normalizer.js';

/** Builds a deterministic incident fingerprint from stable failure evidence rather than volatile run ids. */
export function buildFailureFingerprint(signal: FailureSignal): { fingerprint: string; normalizedSignature: string } {
  const normalizedSignature = [
    `step=${normalizeFailureText(signal.businessStep ?? '')}`,
    `error=${normalizeFailureText(signal.error ?? '')}`,
    `endpoint=${normalizeEndpoint(signal.endpoint ?? '')}`,
    `status=${Number.isInteger(signal.httpStatus) ? signal.httpStatus : ''}`,
    `contract=${normalizeFailureText(signal.contractViolation ?? '')}`,
    `auth=${signal.authStatus ?? ''}`,
    `environment=${normalizeFailureText(signal.environmentSignal ?? '')}`,
    `data=${normalizeFailureText(signal.testDataSignal ?? '')}`,
    `locator=${normalizeFailureText(signal.locatorSignal ?? '')}`,
  ].join('|');
  return {
    fingerprint: createHash('sha256').update(normalizedSignature).digest('hex').slice(0, 16),
    normalizedSignature,
  };
}
