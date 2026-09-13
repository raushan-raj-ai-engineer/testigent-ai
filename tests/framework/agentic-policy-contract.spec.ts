import { expect, test } from '@playwright/test';
import { canPromoteToTrustedEvidence, evaluateAgenticPolicy } from '../../src/framework/agentic/policy/agentic-policy.js';

test.describe('Agentic trust boundary contract', () => {
  test('missing provenance fails closed', () => {
    const result = evaluateAgenticPolicy({ hasProvenance: false, evidenceCount: 0, policyViolationCount: 0, deterministicValidationPassed: true, confidence: 0.99 });
    expect(result).toMatchObject({ state: 'INSUFFICIENT_EVIDENCE', trusted: false });
  });
  test('policy violations are rejected', () => {
    const result = evaluateAgenticPolicy({ hasProvenance: true, evidenceCount: 2, policyViolationCount: 1, deterministicValidationPassed: true, confidence: 0.99 });
    expect(result).toMatchObject({ state: 'REJECTED', trusted: false });
  });
  test('deterministic validation remains stronger than agent confidence', () => {
    const result = evaluateAgenticPolicy({ hasProvenance: true, evidenceCount: 2, policyViolationCount: 0, deterministicValidationPassed: false, confidence: 1 });
    expect(result.state).toBe('REVIEW_REQUIRED');
  });
  test('human approval is mandatory when policy requires it', () => {
    const result = evaluateAgenticPolicy({ hasProvenance: true, evidenceCount: 2, policyViolationCount: 0, deterministicValidationPassed: true, confidence: 0.95, humanApprovalRequired: true, humanApproved: false });
    expect(result).toMatchObject({ state: 'REVIEW_REQUIRED', trusted: false });
  });
  test('provider degradation cannot be promoted as trusted evidence', () => {
    const result = evaluateAgenticPolicy({ hasProvenance: true, evidenceCount: 2, policyViolationCount: 0, deterministicValidationPassed: true, confidence: 0.95, providerDegraded: true });
    expect(result).toMatchObject({ state: 'DEGRADED', trusted: false });
  });
  test('fully governed evidence can be accepted', () => {
    const result = evaluateAgenticPolicy({ hasProvenance: true, evidenceCount: 3, policyViolationCount: 0, deterministicValidationPassed: true, confidence: 0.92, humanApprovalRequired: true, humanApproved: true });
    expect(result).toMatchObject({ state: 'ACCEPTED', trusted: true });
  });
  test('only ACCEPTED is promotable', () => {
    expect(canPromoteToTrustedEvidence('ACCEPTED')).toBe(true);
    for (const state of ['REJECTED', 'REVIEW_REQUIRED', 'INSUFFICIENT_EVIDENCE', 'SKIPPED', 'DEGRADED'] as const) expect(canPromoteToTrustedEvidence(state)).toBe(false);
  });
});
