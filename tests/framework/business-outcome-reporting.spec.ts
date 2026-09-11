import { expect, test } from '@playwright/test';
import { buildExecutionFacts } from '../../src/framework/analytics/execution-facts';
import type { BusinessTestResult, HealingSummary } from '../../src/framework/analytics/report.types';
import { renderBusinessHtml } from '../../src/framework/reporting/business-html.renderer';
import { buildBusinessEmailText } from '../../src/framework/notifications/business-email.template';

/**
 * Author: Raushan Raj
 * Business Use: Protects business-standard reporting semantics for known defects and CI-blocking outcomes.
 */
test.describe('Business outcome reporting', () => {
  test('counts known defects as quality failed but keeps them non-blocking', () => {
    const facts = buildExecutionFacts({
      runId: 'known-defect-contract', environment: 'qa', application: 'demo', healing: noHealing(),
      results: [
        result('pass', 'Healthy checkout', 'passed'),
        { ...result('known', 'Delete user', 'failed'), knownDefect: { id: 'BUG-101', title: 'Delete does not remove user', scope: 'User Management > Delete' } },
        result('skip', 'Optional database', 'skipped')
      ]
    });

    expect(facts.knownDefects).toBe(1);
    expect(facts.qualityFailed).toBe(1);
    expect(facts.unexpectedFailed).toBe(0);
    expect(facts.ciBlockingIssues).toBe(0);
    expect(facts.results.find(item => item.testId === 'known')?.outcome).toBe('KNOWN_DEFECT');
    expect(facts.results.find(item => item.testId === 'known')?.qualityStatus).toBe('FAIL');
    expect(facts.results.find(item => item.testId === 'known')?.ciBlocking).toBe(false);
    expect(facts.qualityPassRate).toBe(50);

    const html = renderBusinessHtml(facts);
    expect(html).toContain('Known defects &amp; accepted risk');
    expect(html).toContain('BUG-101');
    expect(html).toContain('Quality failed');
    expect(html).toContain('NON-BLOCKING ACCEPTED DEFECT');
    expect(buildBusinessEmailText(facts)).toContain('Known defects: 1');
  });

  test('unexpected failure and unexpected pass are CI-blocking attention items', () => {
    const unexpectedPass = { ...result('fixed', 'Known defect may be fixed', 'passed'), knownDefect: { id: 'BUG-202', title: 'Old defect' } };
    const facts = buildExecutionFacts({
      runId: 'blocking-contract', environment: 'qa', application: 'demo', healing: noHealing(),
      results: [result('fail', 'New regression', 'failed'), unexpectedPass]
    });
    expect(facts.unexpectedFailed).toBe(1);
    expect(facts.unexpectedPass).toBe(1);
    expect(facts.ciBlockingIssues).toBe(2);
    expect(facts.qualityFailed).toBe(1);
    expect(facts.results.find(item => item.testId === 'fixed')?.outcome).toBe('UNEXPECTED_PASS');
    expect(facts.qualityGate.status).toBe('ATTENTION_REQUIRED');
  });

  test('known-defect-only debt can produce passed with accepted risk when threshold is met', () => {
    const previous = process.env.BUSINESS_PASS_THRESHOLD;
    process.env.BUSINESS_PASS_THRESHOLD = '50';
    try {
      const facts = buildExecutionFacts({
        runId: 'accepted-risk', environment: 'qa', application: 'demo', healing: noHealing(),
        results: [
          result('pass', 'Healthy flow', 'passed'),
          { ...result('known', 'Accepted defect', 'failed'), knownDefect: { id: 'BUG-303', title: 'Accepted defect' } }
        ]
      });
      expect(facts.qualityPassRate).toBe(50);
      expect(facts.qualityGate.status).toBe('PASSED_WITH_ACCEPTED_RISK');
      expect(facts.ciBlockingIssues).toBe(0);
    } finally {
      if (previous === undefined) delete process.env.BUSINESS_PASS_THRESHOLD; else process.env.BUSINESS_PASS_THRESHOLD = previous;
    }
  });
});

function result(testId: string, title: string, status: 'passed' | 'failed' | 'skipped'): BusinessTestResult {
  return {
    testId, title, project: 'chromium', status, rawStatus: status, durationMs: 100, totalDurationMs: 100,
    retriesUsed: 0, flaky: false, tags: [], steps: [], error: status === 'failed' ? 'Synthetic failure' : undefined,
    attempts: [{ retry: 0, status, durationMs: 100, error: status === 'failed' ? 'Synthetic failure' : undefined }]
  };
}
function noHealing(): HealingSummary { return { count:0, fallback:0, cache:0, ai:0, affectedTests:0, records:[], attempts:[], attemptCount:0, rejected:0, suggested:0, unverified:0 }; }
