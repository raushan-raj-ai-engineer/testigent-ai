import { expect, test } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildExecutionFacts } from '../../src/framework/analytics/execution-facts.js';
import { buildEvidenceGraph, renderEvidenceLedgerHtml } from '../../src/framework/analytics/evidence-graph.js';
import { writeBusinessDashboard } from '../../src/framework/reporting/business-dashboard.writer.js';
import { analyzeChangeImpact } from '../../src/framework/intelligence/change-impact.js';
import type { BusinessTestResult, HealingSummary } from '../../src/framework/analytics/report.types.js';

const emptyHealing: HealingSummary = {
  count: 0, fallback: 0, cache: 0, ai: 0, affectedTests: 0,
  records: [], attempts: [], attemptCount: 0, rejected: 0, suggested: 0, unverified: 0
};

test.describe('Quality evidence and release intelligence', () => {
  test('dashboard claims have a deterministic one-click evidence ledger and provenance graph', async () => {
    const result: BusinessTestResult = {
      testId: 'scenario-1',
      title: 'Payment can be submitted @requirement:PAY-101 @critical',
      project: 'chromium',
      status: 'passed',
      rawStatus: 'passed',
      durationMs: 25,
      totalDurationMs: 25,
      retriesUsed: 0,
      flaky: false,
      tags: ['@requirement:PAY-101', '@critical', '@ui'],
      steps: ['Submit payment', 'Verify confirmation'],
      stepDetails: [],
      attachments: [],
      attempts: [{ retry: 0, status: 'passed', durationMs: 25 }],
      sourceFile: 'projects/demo/tests/e2e/payment.generated.spec.ts'
    };
    const facts = buildExecutionFacts({ runId: 'evidence-contract-run', environment: 'qa', application: 'demo', results: [result], healing: emptyHealing });
    const graph = buildEvidenceGraph(facts);

    expect(graph.claims.find(claim => claim.id === 'quality-pass-rate')?.value).toBe('100%');
    expect(graph.nodes.some(node => node.type === 'requirement' && node.label === 'PAY-101')).toBe(true);
    expect(graph.edges.some(edge => edge.relation === 'implements')).toBe(true);
    expect(graph.traceability.completeness).toBe(100);

    const output = await mkdtemp(join(tmpdir(), 'testigent-evidence-'));
    try {
      writeBusinessDashboard(output, facts);
      const dashboard = await readFile(join(output, 'index.html'), 'utf8');
      const ledger = await readFile(join(output, 'evidence-ledger.html'), 'utf8');
      const graphJson = JSON.parse(await readFile(join(output, 'evidence-graph.json'), 'utf8')) as { schemaVersion: number; runId: string };
      expect(dashboard).toContain('Verify dashboard claims');
      expect(dashboard).toContain('evidence-ledger.html#claim-quality-pass-rate');
      expect(ledger).toContain('Truth boundary:');
      expect(ledger).toContain('PAY-101');
      expect(graphJson).toMatchObject({ schemaVersion: 1, runId: 'evidence-contract-run' });
    } finally {
      await rm(output, { recursive: true, force: true });
    }
  });


  test('empty execution scope is reported as insufficient evidence rather than a low-risk release', async () => {
    const facts = buildExecutionFacts({ runId: 'empty-evidence-run', environment: 'qa', application: 'demo', results: [], healing: emptyHealing });
    const graph = buildEvidenceGraph(facts);
    const decision = graph.claims.find(claim => claim.id === 'release-decision');
    const risk = graph.claims.find(claim => claim.id === 'release-risk');
    const coverage = graph.claims.find(claim => claim.id === 'execution-coverage');
    const quality = graph.claims.find(claim => claim.id === 'quality-pass-rate');

    expect(decision).toMatchObject({ value: 'INSUFFICIENT EVIDENCE', status: 'INCOMPLETE' });
    expect(risk).toMatchObject({ value: 'UNKNOWN · PARTIAL EVIDENCE', status: 'INCOMPLETE' });
    expect(coverage).toMatchObject({ value: 'N/A', status: 'INCOMPLETE' });
    expect(quality).toMatchObject({ value: 'N/A', status: 'INCOMPLETE' });
    expect(graph.traceability.completeness).toBe(0);
  });


  test('evidence graph has no dangling edges and ledger refuses unsafe attachment paths', () => {
    const result: BusinessTestResult = {
      testId: 'scenario-safe-link', title: 'Evidence safety @requirement:EVID-1', project: 'chromium', status: 'passed', rawStatus: 'passed',
      durationMs: 10, totalDurationMs: 10, retriesUsed: 0, flaky: false, tags: ['@requirement:EVID-1'], steps: [], stepDetails: [],
      attachments: [
        { name: 'safe-proof', contentType: 'text/plain', reportPath: 'evidence/scenario-safe-link/proof.txt' },
        { name: 'unsafe-proof', contentType: 'text/plain', reportPath: '../../outside.txt' }
      ],
      attempts: [{ retry: 0, status: 'passed', durationMs: 10 }], sourceFile: 'projects/demo/tests/e2e/evidence.spec.ts'
    };
    const facts = buildExecutionFacts({ runId: 'graph-integrity-run', environment: 'qa', application: 'demo', results: [result], healing: emptyHealing });
    expect(facts.aiUsage).toBeDefined();
    if (!facts.aiUsage) throw new Error('Expected buildExecutionFacts() to materialize the AI usage summary.');
    facts.aiUsage.records.push({ runId: facts.runId, testId: 'excluded-test', timestamp: new Date().toISOString(), purpose: 'reporting', status: 'success', provider: 'synthetic', model: 'synthetic', latencyMs: 1 });
    const graph = buildEvidenceGraph(facts);
    const nodeIds = new Set(graph.nodes.map(node => node.id));
    expect(graph.edges.every(edge => nodeIds.has(edge.from) && nodeIds.has(edge.to))).toBe(true);
    const ledger = renderEvidenceLedgerHtml(graph, facts);
    expect(ledger).toContain('safe-proof');
    expect(ledger).toContain('./evidence/scenario-safe-link/proof.txt');
    expect(ledger).not.toContain('href="./../../outside.txt"');
  });

  test('change impact selects transitive project tests and explains why without silently narrowing CI', () => {
    const impact = analyzeChangeImpact({
      root: process.cwd(),
      application: 'demo',
      changedFiles: ['projects/demo/src/pages/todo.page.ts']
    });
    expect(impact.selectionMode).toBe('targeted');
    expect(impact.selectedTests.some(item => item.file.endsWith('projects/demo/tests/ui/todo.spec.ts'))).toBe(true);
    expect(impact.caveats.join(' ')).toContain('advisory');
  });


  test('unresolved project-owned changes fail safe instead of recommending zero tests', () => {
    const impact = analyzeChangeImpact({
      root: process.cwd(),
      application: 'demo',
      changedFiles: ['projects/demo/src/support/opaque-zqxj.ts']
    });
    expect(impact.selectionMode).toBe('all-project-tests');
    expect(impact.selectedTests.length).toBeGreaterThan(5);
    expect(impact.selectedTests.every(item => item.reasons.some(reason => reason.includes('unresolved project change')))).toBe(true);
  });

  test('generic filename tokens cannot masquerade as targeted ownership evidence', () => {
    const impact = analyzeChangeImpact({
      root: process.cwd(),
      application: 'demo',
      changedFiles: ['projects/demo/src/support/not-mapped.ts']
    });
    expect(impact.selectionMode).toBe('all-project-tests');
    expect(impact.selectedTests.every(item => item.reasons.some(reason => reason.includes('unresolved project change')))).toBe(true);
  });

  test('shared framework changes fail safe to all project tests', () => {
    const impact = analyzeChangeImpact({
      root: process.cwd(),
      application: 'demo',
      changedFiles: ['src/framework/reporting/business-dashboard.writer.ts']
    });
    expect(impact.selectionMode).toBe('all-project-tests');
    expect(impact.selectedTests.length).toBeGreaterThan(5);
    expect(impact.selectedTests.every(item => item.reasons.some(reason => reason.includes('shared framework/config changed')))).toBe(true);
  });
});
