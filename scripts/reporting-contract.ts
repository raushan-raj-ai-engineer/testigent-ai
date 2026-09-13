import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildExecutionFacts } from '../src/framework/analytics/execution-facts';
import type { BusinessTestResult, HealingSummary } from '../src/framework/analytics/report.types';
import { renderBusinessHtml } from '../src/framework/reporting/business-html.renderer';
import { writeBusinessDashboard } from '../src/framework/reporting/business-dashboard.writer';
import { buildBusinessEmailText } from '../src/framework/notifications/business-email.template';

/**
 * Author: Raushan Raj
 * Business Use: Runtime contract for business-standard reporting semantics.
 * How to use: `npm run reporting:contract` or as part of `npm run qa:validate`.
 * Benefit: Prevents a green CI run from hiding known-defect quality debt or misclassifying CI-blocking outcomes.
 */
function main(): void {
  const previousThreshold = process.env.BUSINESS_PASS_THRESHOLD;
  process.env.BUSINESS_PASS_THRESHOLD = '50';
  try {
    const knownDefectFacts = buildExecutionFacts({
      runId: 'reporting-contract-known-defect',
      environment: 'qa',
      application: 'contract',
      healing: noHealing(),
      results: [
        result('pass', 'Healthy checkout', 'passed'),
        {
          ...result('known', 'Delete user', 'failed'),
          knownDefect: {
            id: 'BUG-101',
            title: 'Delete does not remove user',
            scope: 'User Management > Delete',
            note: 'Accepted for current release.'
          }
        },
        { ...result('skip', 'Optional database', 'skipped'), skipReason: 'Database capability is optional and disabled for this project/environment.', skipCategory: 'DATABASE_NOT_CONFIGURED' as const }
      ]
    });

    assert.equal(knownDefectFacts.knownDefects, 1);
    assert.equal(knownDefectFacts.qualityFailed, 1);
    assert.equal(knownDefectFacts.unexpectedFailed, 0);
    assert.equal(knownDefectFacts.ciBlockingIssues, 0);
    assert.equal(knownDefectFacts.qualityPassRate, 50);
    assert.equal(knownDefectFacts.qualityGate.status, 'PASSED_WITH_ACCEPTED_RISK');
    assert.equal(knownDefectFacts.results.find(item => item.testId === 'known')?.outcome, 'KNOWN_DEFECT');
    assert.equal(knownDefectFacts.results.find(item => item.testId === 'known')?.qualityStatus, 'FAIL');
    assert.equal(knownDefectFacts.results.find(item => item.testId === 'known')?.ciBlocking, false);

    const previousContractThreshold = process.env.BUSINESS_PASS_THRESHOLD;
    process.env.BUSINESS_PASS_THRESHOLD = '95';
    const acceptedDebtOnly = buildExecutionFacts({
      runId: 'reporting-contract-accepted-debt-only', environment: 'qa', application: 'contract', healing: noHealing(),
      results: [
        { ...result('known-only', 'Delete user', 'failed'), knownDefect: { id: 'BUG-ONLY', title: 'Accepted delete defect' } },
        { ...result('db-na-only', 'Optional database', 'skipped'), skipReason: 'Database capability is optional and disabled for this project/environment.', skipCategory: 'DATABASE_NOT_CONFIGURED' as const }
      ]
    });
    assert.equal(acceptedDebtOnly.executionEligible, 1);
    assert.equal(acceptedDebtOnly.executed, 1);
    assert.equal(acceptedDebtOnly.executionRate, 100);
    assert.equal(acceptedDebtOnly.qualityPassRate, 0);
    assert.equal(acceptedDebtOnly.qualityGate.status, 'PASSED_WITH_ACCEPTED_RISK', 'Accepted known-defect debt alone must not become ATTENTION_REQUIRED merely because the quality-pass threshold is missed.');
    if (previousContractThreshold === undefined) process.env.BUSINESS_PASS_THRESHOLD = '50'; else process.env.BUSINESS_PASS_THRESHOLD = previousContractThreshold;

    const dashboard = renderBusinessHtml(knownDefectFacts);
    const email = buildBusinessEmailText(knownDefectFacts);
    for (const token of ['Quality failed', 'Known defects &amp; accepted risk', 'CI-blocking issues', 'BUG-101', 'Slowest scenarios', 'Verify dashboard claims', 'Release risk:']) {
      assert.ok(dashboard.includes(token), `Business dashboard is missing required token: ${token}`);
    }
    for (const token of ['Quality failed: 1', 'Known defects: 1', 'CI-blocking issues: 0']) {
      assert.ok(email.includes(token), `Business email is missing required token: ${token}`);
    }


    const emptyFacts = buildExecutionFacts({ runId: 'reporting-contract-empty', environment: 'qa', application: 'contract', healing: noHealing(), results: [] });
    const emptyDashboard = renderBusinessHtml(emptyFacts);
    assert.ok(emptyDashboard.includes('INSUFFICIENT EVIDENCE'), 'Empty scope must not render a release-ready decision.');
    assert.ok(emptyDashboard.includes('Release risk:</b> UNKNOWN'), 'Empty scope must expose unknown release risk.');
    assert.ok(emptyDashboard.includes('No quality-executed denominator'), 'Empty scope must not present a synthetic quality pass percentage.');
    assert.ok(!emptyDashboard.includes('N/A%'), 'N/A metrics must never be rendered as percentages.');

    const blockingFacts = buildExecutionFacts({
      runId: 'reporting-contract-blocking',
      environment: 'qa', application: 'contract', healing: noHealing(),
      results: [
        result('failure', 'New regression', 'failed'),
        {
          ...result('unexpected-pass', 'Registered defect now passes', 'passed'),
          knownDefect: { id: 'BUG-202', title: 'Old accepted defect' }
        }
      ]
    });
    assert.equal(blockingFacts.unexpectedFailed, 1);
    assert.equal(blockingFacts.unexpectedPass, 1);
    assert.equal(blockingFacts.qualityFailed, 1);
    assert.equal(blockingFacts.ciBlockingIssues, 2);
    assert.equal(blockingFacts.qualityGate.status, 'ATTENTION_REQUIRED');
    assert.equal(blockingFacts.results.find(item => item.testId === 'unexpected-pass')?.outcome, 'UNEXPECTED_PASS');

    const coverageFacts = buildExecutionFacts({
      runId: 'reporting-contract-coverage',
      environment: 'qa',
      application: 'contract',
      healing: noHealing(),
      results: [
        ...Array.from({ length: 29 }, (_, index) => result(`pass-${index + 1}`, `Healthy scenario ${index + 1}`, 'passed')),
        { ...result('skip-coverage', 'Optional database', 'skipped'), skipReason: 'Database capability is optional and disabled for this project/environment.', skipCategory: 'DATABASE_NOT_CONFIGURED' as const }
      ]
    });
    assert.equal(coverageFacts.qualityPassRate, 100, 'Skipped scenarios must not reduce product quality pass rate.');
    assert.equal(coverageFacts.executionRate, 100, 'Not-applicable scenarios must be removed from the execution-coverage denominator.');
    assert.equal(coverageFacts.notApplicable, 1);
    assert.equal(coverageFacts.executionEligible, 29);
    const coverageEmail = buildBusinessEmailText(coverageFacts);
    assert.ok(coverageEmail.includes('Quality pass rate: 100%'), 'Email must present quality pass rate independently from execution coverage.');
    assert.ok(coverageEmail.includes('Execution coverage: 100%'), 'Email must present applicable execution coverage independently from quality pass rate.');

    const evidenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-report-contract-'));
    try {
      const screenshotPath = path.join(evidenceRoot, 'failure.png');
      fs.writeFileSync(screenshotPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlY4QAAAABJRU5ErkJggg==', 'base64'));
      fs.writeFileSync(path.join(evidenceRoot, 'trace.zip'), Buffer.from('trace'));
      const evidenceFacts = buildExecutionFacts({
        runId: 'reporting-contract-evidence', environment: 'qa', application: 'contract', healing: noHealing(),
        results: [{
          ...result('evidence-failure', 'Checkout failure', 'failed'),
          stepDetails: [{ title: 'Submit order', category: 'test.step', durationMs: 20, status: 'failed', error: 'Order was not submitted', children: [] }],
          attachments: [
            { name: 'failure-screenshot', contentType: 'image/png', sourcePath: screenshotPath },
            { name: 'trace', contentType: 'application/zip', sourcePath: path.join(evidenceRoot, 'trace.zip') }
          ]
        }]
      });
      const bundleDir = path.join(evidenceRoot, 'bundle');
      const written = writeBusinessDashboard(bundleDir, evidenceFacts);
      const html = fs.readFileSync(path.join(bundleDir, 'index.html'), 'utf8');
      const evidenceLedger = fs.readFileSync(path.join(bundleDir, 'evidence-ledger.html'), 'utf8');
      const providerHealth = fs.readFileSync(path.join(bundleDir, 'ai-provider-health.html'), 'utf8');
      const evidenceGraph = JSON.parse(fs.readFileSync(path.join(bundleDir, 'evidence-graph.json'), 'utf8')) as { schemaVersion: number; claims: Array<{ id: string }>; runId: string };
      assert.equal(evidenceGraph.schemaVersion, 1);
      assert.equal(evidenceGraph.runId, 'reporting-contract-evidence');
      assert.ok(evidenceGraph.claims.some(claim => claim.id === 'release-decision'), 'Evidence graph must include the release decision claim.');
      assert.ok(evidenceGraph.claims.some(claim => claim.id === 'release-risk'), 'Evidence graph must include explainable release risk.');
      assert.ok(evidenceLedger.includes('Truth boundary:'), 'Evidence ledger must state its claim boundary explicitly.');
      assert.ok(evidenceLedger.includes('failure-screenshot'), 'Evidence ledger must link materialized scenario evidence directly.');
      assert.ok(html.includes('evidence-ledger.html'), 'Business dashboard must expose the evidence ledger in one click.');
      assert.ok(html.includes('ai-provider-health.html'), 'Business dashboard must expose live AI provider health in one click.');
      assert.ok(providerHealth.includes('Operational canary only'), 'AI provider health must state that the live canary is operational rather than a release-correctness fact.');
      assert.ok(providerHealth.includes('Truth boundary'), 'AI provider health drill-down must preserve its truth boundary.');
      assert.ok(html.includes('Failure evidence'), 'Failed test.step must expose failure evidence inline.');
      assert.ok(html.includes('<img'), 'Failure screenshot must render as an inline image preview.');
      assert.equal((html.match(/<img\b/g) ?? []).length, 1, 'Primary failure screenshot must render exactly once in the business dashboard.');
      assert.ok(html.includes('Additional attachments'), 'Scenario evidence must clearly separate additional attachments from inline failure evidence.');
      const additionalSection = html.slice(html.indexOf('Additional attachments'));
      assert.equal((additionalSection.match(/<img\b/g) ?? []).length, 0, 'Inline failure screenshot must not be repeated in additional attachments.');
      assert.ok(additionalSection.includes('trace'), 'Non-image evidence such as trace must remain available as an additional attachment.');
      assert.ok(written.results[0].attachments?.[0].reportPath, 'Failure screenshot must be materialized into the business bundle.');
      assert.ok(fs.existsSync(path.join(bundleDir, written.results[0].attachments![0].reportPath!)), 'Materialized failure screenshot must exist.');
    } finally {
      fs.rmSync(evidenceRoot, { recursive: true, force: true });
    }

    const blockedFacts = buildExecutionFacts({
      runId: 'reporting-contract-blocked',
      environment: 'qa', application: 'contract', healing: noHealing(),
      results: [
        result('pass-blocked', 'Healthy scenario', 'passed'),
        { ...result('blocked-review', 'Generated review pending', 'skipped'), skipReason: 'REVIEW_REQUIRED: approve mappings before execution.', skipCategory: 'HUMAN_REVIEW_PENDING' as const }
      ]
    });
    assert.equal(blockedFacts.executionEligible, 2);
    assert.equal(blockedFacts.executed, 1);
    assert.equal(blockedFacts.executionRate, 50);
    assert.equal(blockedFacts.blockedSkipped, 1);
    assert.equal(blockedFacts.qualityGate.status, 'ATTENTION_REQUIRED');

    console.log(JSON.stringify({
      ok: true,
      knownDefect: {
        qualityFailed: knownDefectFacts.qualityFailed,
        ciBlockingIssues: knownDefectFacts.ciBlockingIssues,
        qualityPassRate: knownDefectFacts.qualityPassRate,
        gate: knownDefectFacts.qualityGate.status
      },
      attention: {
        unexpectedFailed: blockingFacts.unexpectedFailed,
        unexpectedPass: blockingFacts.unexpectedPass,
        ciBlockingIssues: blockingFacts.ciBlockingIssues,
        gate: blockingFacts.qualityGate.status
      },
      coverage: {
        qualityPassRate: coverageFacts.qualityPassRate,
        executionRate: coverageFacts.executionRate
      }
    }, null, 2));
  } finally {
    if (previousThreshold === undefined) delete process.env.BUSINESS_PASS_THRESHOLD;
    else process.env.BUSINESS_PASS_THRESHOLD = previousThreshold;
  }
}

function result(testId: string, title: string, status: 'passed' | 'failed' | 'skipped'): BusinessTestResult {
  return {
    testId,
    title,
    project: 'chromium',
    status,
    rawStatus: status,
    durationMs: 100,
    totalDurationMs: 100,
    retriesUsed: 0,
    flaky: false,
    tags: [],
    steps: [],
    error: status === 'failed' ? 'Synthetic failure' : undefined,
    attempts: [{ retry: 0, status, durationMs: 100, error: status === 'failed' ? 'Synthetic failure' : undefined }]
  };
}

function noHealing(): HealingSummary {
  return {
    count: 0, fallback: 0, cache: 0, ai: 0, affectedTests: 0,
    records: [], attempts: [], attemptCount: 0, rejected: 0, suggested: 0, unverified: 0
  };
}

main();
