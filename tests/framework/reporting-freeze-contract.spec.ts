import { expect, test } from '@playwright/test';
import fs from 'node:fs';

const frozenSurfaces = [
  'evidence-ledger.html',
  'agentic-intelligence.html',
  'adoption-intelligence.html',
  'benchmark-intelligence.html',
  'api-contract-intelligence.html',
  'failure-intelligence.html',
  'showcase.html',
];

test.describe('v1.9 reporting freeze contract', () => {
  test('documents the freeze boundary and keeps the approved drill-down surface explicit', () => {
    const policy = fs.readFileSync('docs/63-REPORTING-FREEZE.md', 'utf8');
    expect(policy).toContain('REPORTING SURFACE FREEZE');
    expect(policy).toContain('bug/security/accessibility/compatibility/performance');
    const renderer = fs.readFileSync('src/framework/reporting/business-html.renderer.ts', 'utf8');
    for (const surface of frozenSurfaces) expect(renderer).toContain(surface);
  });

  test('customer showcase stays a separate synthetic drill-down instead of contaminating live facts', () => {
    const writer = fs.readFileSync('src/framework/reporting/business-dashboard.writer.ts', 'utf8');
    expect(writer).toContain("path.join(outputDir, 'showcase.html')");
    expect(writer).toContain("path.join(outputDir, 'business-report.json')");
    expect(writer).not.toContain('facts.results.push(...dataset.scenarios');
  });
});
