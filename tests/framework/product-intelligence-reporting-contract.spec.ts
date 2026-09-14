import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildExecutionFacts } from '../../src/framework/analytics/execution-facts.js';
import type { HealingSummary } from '../../src/framework/analytics/report.types.js';
import { writeBusinessDashboard } from '../../src/framework/reporting/business-dashboard.writer.js';

test('business dashboard exposes adoption, benchmark and API contract intelligence without inventing evidence', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-product-intelligence-'));
  const facts = buildExecutionFacts({ runId: 'product-intelligence-report', application: 'product-intelligence-fixture', environment: 'qa', results: [], healing: emptyHealing() });
  try {
    writeBusinessDashboard(output, facts);
    const index = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
    expect(index).toContain('adoption-intelligence.html');
    expect(index).toContain('benchmark-intelligence.html');
    expect(index).toContain('api-contract-intelligence.html');
    expect(fs.readFileSync(path.join(output, 'adoption-intelligence.html'), 'utf8')).toContain('INSUFFICIENT_EVIDENCE');
    expect(fs.readFileSync(path.join(output, 'benchmark-intelligence.html'), 'utf8')).toContain('INSUFFICIENT_EVIDENCE');
    expect(fs.readFileSync(path.join(output, 'api-contract-intelligence.html'), 'utf8')).toContain('NO_EVIDENCE');
  } finally { fs.rmSync(output, { recursive: true, force: true }); }
});

function emptyHealing(): HealingSummary { return { count: 0, fallback: 0, cache: 0, ai: 0, affectedTests: 0, records: [], attempts: [], attemptCount: 0, rejected: 0, suggested: 0, unverified: 0 }; }
