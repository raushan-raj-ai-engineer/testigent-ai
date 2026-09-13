import { expect, test } from '@playwright/test';

import {
  canPromoteToTrustedEvidence,
  evaluateAgenticPolicy,
} from '../../src/framework/agentic/policy/agentic-policy';

test.describe('Agentic trust boundary contract', () => {
  test('missing provenance fails closed', () => {
    const result = evaluateAgenticPolicy({
      hasProvenance: false,
      evidenceCount: 0,
      policyViolationCount: 0,
      deterministicValidationPassed: true,
      confidence: 0.99,
    });

    expect(result.state).toBe('INSUFFICIENT_EVIDENCE');
    expect(result.trusted).toBe(false);
  });

  test('policy violations are rejected', () => {
    const result = evaluateAgenticPolicy({
      hasProvenance: true,
      evidenceCount: 2,
      policyViolationCount: 1,
      deterministicValidationPassed: true,
      confidence: 0.99,
    });

    expect(result.state).toBe('REJECTED');
    expect(result.trusted).toBe(false);
  });

  test('failed deterministic validation requires review', () => {
    const result = evaluateAgenticPolicy({
      hasProvenance: true,
      evidenceCount: 2,
      policyViolationCount: 0,
      deterministicValidationPassed: false,
      confidence: 0.99,
    });

    expect(result.state).toBe('REVIEW_REQUIRED');
    expect(result.trusted).toBe(false);
  });

  test('low confidence cannot cross the trust boundary', () => {
    const result = evaluateAgenticPolicy({
      hasProvenance: true,
      evidenceCount: 2,
      policyViolationCount: 0,
      deterministicValidationPassed: true,
      confidence: 0.55,
      minimumConfidence: 0.75,
    });

    expect(result.state).toBe('REVIEW_REQUIRED');
    expect(result.trusted).toBe(false);
  });

  test('valid deterministic evidence may be accepted', () => {
    const result = evaluateAgenticPolicy({
      hasProvenance: true,
      evidenceCount: 3,
      policyViolationCount: 0,
      deterministicValidationPassed: true,
      confidence: 0.92,
    });

    expect(result.state).toBe('ACCEPTED');
    expect(result.trusted).toBe(true);
  });

  test('only ACCEPTED state can become trusted evidence', () => {
    expect(canPromoteToTrustedEvidence('ACCEPTED')).toBe(true);

    expect(canPromoteToTrustedEvidence('REJECTED')).toBe(false);
    expect(canPromoteToTrustedEvidence('REVIEW_REQUIRED')).toBe(false);
    expect(canPromoteToTrustedEvidence('INSUFFICIENT_EVIDENCE')).toBe(false);
    expect(canPromoteToTrustedEvidence('SKIPPED')).toBe(false);
    expect(canPromoteToTrustedEvidence('DEGRADED')).toBe(false);
  });
});
