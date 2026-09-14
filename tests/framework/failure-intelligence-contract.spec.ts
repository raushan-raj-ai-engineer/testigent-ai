import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { analyzeFailureIntelligence } from '../../src/framework/failure-intelligence/failure-analyzer.js';
import { classifyFailureDeterministically } from '../../src/framework/failure-intelligence/deterministic-classifier.js';
import { FailureHistoryStore } from '../../src/framework/failure-intelligence/failure-history.store.js';
import type { FailureSignal } from '../../src/framework/failure-intelligence/failure-intelligence.types.js';
import { invokeAgenticMcpTool, listAgenticMcpTools } from '../../src/framework/mcp/tool-registry.js';

const base: FailureSignal = { scenarioId: 'S1', title: 'Create order', application: 'orders', businessStep: 'Submit order', error: 'server returned internal error', endpoint: '/orders/48192', httpStatus: 500, authStatus: 'VALID', evidenceMode: 'LIVE', synthetic: false, claimEligible: true };

test.describe('Failure Intelligence deterministic contract', () => {
  test('classifies evidence-backed root causes without requiring AI', () => {
    expect(classifyFailureDeterministically(base).category).toBe('PRODUCT_DEFECT');
    expect(classifyFailureDeterministically({ ...base, authStatus: 'EXPIRED' }).category).toBe('AUTH_FAILURE');
    expect(classifyFailureDeterministically({ ...base, contractViolation: "required property 'phone' missing", httpStatus: 200 }).category).toBe('API_CONTRACT_FAILURE');
    expect(classifyFailureDeterministically({ ...base, environmentSignal: 'CI browser worker terminated after out of memory signal', httpStatus: undefined }).category).toBe('ENVIRONMENT_FAILURE');
    expect(classifyFailureDeterministically({ ...base, error: '503 Service Unavailable from upstream gateway', httpStatus: 503 }).category).toBe('DEPENDENCY_FAILURE');
    expect(classifyFailureDeterministically({ ...base, testDataSignal: 'workers reused the same fixture email', httpStatus: 409 }).category).toBe('TEST_DATA_FAILURE');
    expect(classifyFailureDeterministically({ ...base, locatorSignal: 'role=button no longer resolves', httpStatus: undefined, healingOutcome: 'REJECTED' }).category).toBe('AUTOMATION_DEFECT');
    expect(classifyFailureDeterministically({ ...base, error: 'intermittent timeout', httpStatus: undefined, flaky: true, retriesUsed: 1 }).category).toBe('FLAKY_BEHAVIOR');
    expect(classifyFailureDeterministically({ ...base, knownDefectId: 'BUG-481', httpStatus: undefined }).category).toBe('KNOWN_DEFECT');
  });

  test('normalizes volatile ids so the same incident fingerprints together', () => {
    const first = classifyFailureDeterministically({ ...base, error: 'Request id 7f9d798f-03d7-41b4-bc44-28ad4bb57788 failed', endpoint: '/orders/48192' });
    const second = classifyFailureDeterministically({ ...base, scenarioId: 'S2', title: 'Retry order', error: 'Request id ca62eeab-222a-4ce0-ad0b-6e2bace6a613 failed', endpoint: '/orders/77201' });
    expect(first.fingerprint).toBe(second.fingerprint);
    const summary = analyzeFailureIntelligence([{ ...base, error: first.normalizedSignature }, { ...base, scenarioId: 'S2', title: 'Retry order', error: first.normalizedSignature }]);
    expect(summary.uniqueIncidents).toBe(1);
  });

  test('sanitizes secrets and PII before normalized signatures can reach triage evidence', () => {
    const result = classifyFailureDeterministically({ ...base, error: 'authorization=super-secret user qa.person@example.com request failed', httpStatus: undefined });
    expect(result.normalizedSignature).not.toContain('super-secret');
    expect(result.normalizedSignature).not.toContain('qa.person@example.com');
    expect(result.normalizedSignature).toContain('[redacted]');
    expect(result.normalizedSignature).toContain('[email_redacted]');
  });

  test('fails honest when evidence is insufficient and allows only optional governed escalation', () => {
    const result = classifyFailureDeterministically({ scenarioId: 'U1', title: 'Unknown failure', application: 'demo', error: 'scenario ended unexpectedly', evidenceMode: 'LIVE', synthetic: false, claimEligible: false });
    expect(result.category).toBe('UNKNOWN');
    expect(result.confidence).toBe('INSUFFICIENT_EVIDENCE');
    expect(result.aiEscalationAllowed).toBe(true);
    expect(result.claimEligible).toBe(false);
    expect(result.humanConfirmationRecommended).toBe(true);

    const genericReceived = classifyFailureDeterministically({
      scenarioId: 'U2',
      title: 'Ambiguous receipt',
      application: 'demo',
      error: 'request was received unexpectedly',
      evidenceMode: 'LIVE',
      synthetic: false,
      claimEligible: false
    });
    expect(genericReceived.category).toBe('UNKNOWN');

    const assertion = classifyFailureDeterministically({
      scenarioId: 'U3',
      title: 'Incorrect order total',
      application: 'demo',
      businessStep: 'Verify order total',
      error: 'Expected 42.00 but Received 41.00',
      evidenceMode: 'LIVE',
      synthetic: false,
      claimEligible: true
    });
    expect(assertion.category).toBe('PRODUCT_DEFECT');
    expect(assertion.reasonCodes).toContain('BUSINESS_ASSERTION_FAILED');
  });

  test('governed MCP exposes read-only failure explanation and triage using the same deterministic engine', async () => {
    const tools = listAgenticMcpTools();
    for (const name of ['testigent_explain_failure', 'testigent_triage_failures']) {
      const tool = tools.find(item => item.name === name);
      expect(tool).toBeTruthy();
      expect(tool?.annotations?.readOnlyHint).toBe(true);
      expect(tool?.annotations?.destructiveHint).toBe(false);
    }
    const context = { root: process.cwd(), runId: 'failure-contract', environment: 'qa' };
    const explained = await invokeAgenticMcpTool('testigent_explain_failure', { signal: { scenarioId: 'M1', title: 'Create order', application: 'orders', businessStep: 'Submit order', error: 'server internal error', endpoint: '/orders/41', httpStatus: 500, authStatus: 'VALID' } }, context) as { category: string };
    expect(explained.category).toBe('PRODUCT_DEFECT');
    const triage = await invokeAgenticMcpTool('testigent_triage_failures', { signals: [
      { scenarioId: 'M1', title: 'Create order', application: 'orders', error: 'server internal error', endpoint: '/orders/41', httpStatus: 500, authStatus: 'VALID' },
      { scenarioId: 'M2', title: 'Retry order', application: 'orders', error: 'server internal error', endpoint: '/orders/99', httpStatus: 500, authStatus: 'VALID' }
    ] }, context) as { uniqueIncidents: number; claimEligible: boolean };
    expect(triage.uniqueIncidents).toBe(1);
    expect(triage.claimEligible).toBe(true);
  });

  test('production history rejects showcase evidence and keeps live records immutable', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-failure-history-'));
    try {
      const store = new FailureHistoryStore(dir);
      const live = classifyFailureDeterministically(base);
      expect(() => store.append({ ...live, evidenceMode: 'SHOWCASE', synthetic: true, claimEligible: false })).toThrow(/FAILURE_HISTORY_TRUST_BOUNDARY/);
      const target = store.append(live);
      expect(fs.existsSync(target)).toBe(true);
      expect(store.similar(live.fingerprint)).toHaveLength(1);
      expect(() => store.append({ ...live, rationale: 'changed immutable evidence' })).toThrow(/FAILURE_HISTORY_CONFLICT/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
