import { expect, test } from '@playwright/test';
import { renderAgenticIntelligenceHtml } from '../../src/framework/reporting/agentic-intelligence.renderer.js';

test('agentic intelligence renderer exposes trust boundary and decision evidence', () => {
  const summary = { status: 'REVIEW_REQUIRED' as const, decisions: 1, trusted: 0, rejected: 0, reviewRequired: 1, insufficientEvidence: 0, degraded: 0, agents: { planner: 0, generator: 0, reviewer: 1, healer: 0, mcp: 0 }, latestAt: '2026-09-13T12:00:00.000Z' };
  const html = renderAgenticIntelligenceHtml(summary, [{ version: 1, id: 'd1', runId: 'r1', application: 'demo', environment: 'qa', timestamp: '2026-09-13T12:00:00.000Z', agent: 'reviewer', operation: 'review-generation-proposal', state: 'REVIEW_REQUIRED', rationale: '<script>alert(1)</script>', confidence: 0.9, policyPassed: true, deterministicValidationPassed: true, humanApprovalRequired: true, humanApproved: false, evidence: [{ kind: 'requirement', ref: 'REQ-1' }], affectedArtifacts: ['projects/demo/tests/x.spec.ts'] }]);
  expect(html).toContain('Agent Decision Ledger');
  expect(html).toContain('Human approval');
  expect(html).not.toContain('<script>alert(1)</script>');
  expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
});
