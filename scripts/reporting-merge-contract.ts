import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildExecutionFacts } from '../src/framework/analytics/execution-facts';
import type { AiRuntimeAuditRecord, BusinessTestResult, HealingAuditRecord, HealingSummary } from '../src/framework/analytics/report.types';
import { mergeBusinessReports } from './merge-business-reports';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`REPORTING_MERGE_CONTRACT_FAILED: ${message}`);
}


function contractResult(input: {
  testId: string;
  title: string;
  status: 'passed' | 'failed' | 'skipped';
  sourceFile: string;
  tags: string[];
  layers: BusinessTestResult['layers'];
  testType: BusinessTestResult['testType'];
  durationMs: number;
  skipCategory?: BusinessTestResult['skipCategory'];
  skipReason?: string;
}): BusinessTestResult {
  return {
    testId: input.testId,
    project: 'chromium',
    title: input.title,
    sourceFile: input.sourceFile,
    status: input.status,
    rawStatus: input.status,
    durationMs: input.durationMs,
    totalDurationMs: input.durationMs,
    retriesUsed: 0,
    flaky: false,
    tags: input.tags,
    layers: input.layers,
    testType: input.testType,
    steps: [],
    attachments: [],
    skipCategory: input.skipCategory,
    skipReason: input.skipReason,
    attempts: [{ retry: 0, status: input.status, durationMs: input.durationMs }]
  };
}

function emptyHealing(): HealingSummary {
  return { count: 0, fallback: 0, cache: 0, ai: 0, affectedTests: 0, records: [], attempts: [], attemptCount: 0, rejected: 0, suggested: 0, unverified: 0 };
}

function writeReport(root: string, name: string, results: BusinessTestResult[], healing = emptyHealing(), aiRecords: AiRuntimeAuditRecord[] = []): void {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  const facts = buildExecutionFacts({
    runId: `run-${name}`,
    environment: 'qa',
    application: 'demo',
    results,
    healing,
    aiUsage: {
      calls: aiRecords.length,
      healingCalls: aiRecords.filter(r => r.purpose === 'healing').length,
      reportingCalls: aiRecords.filter(r => r.purpose === 'reporting').length,
      successfulCalls: aiRecords.filter(r => r.status === 'success').length,
      noResultCalls: aiRecords.filter(r => r.status === 'no-result').length,
      errorCalls: aiRecords.filter(r => r.status === 'error').length,
      budgetBlockedCalls: aiRecords.filter(r => r.status === 'budget-blocked').length,
      averageLatencyMs: 0,
      providers: [],
      records: aiRecords
    }
  });
  fs.writeFileSync(path.join(dir, 'business-report.json'), JSON.stringify(facts, null, 2));
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-merge-contract-'));
const out = path.join(root, 'merged');
const history = path.join(root, 'history.json');
process.env.APP = 'demo';
process.env.ENV = 'qa';
process.env.RUN_ID = 'merged-contract';
process.env.MERGED_BUSINESS_REPORT_DIR = out;
process.env.REPORT_HISTORY_FILE = history;

const pass = contractResult({
  testId: 'ui-pass',
  title: 'Customer can create order @ui',
  status: 'passed',
  sourceFile: 'projects/demo/tests/ui/order.spec.ts',
  tags: ['@ui'],
  layers: ['UI'],
  testType: 'UI_ONLY',
  durationMs: 100
});
const dbNa = contractResult({
  testId: 'db-na',
  title: 'Database health @db',
  status: 'skipped',
  sourceFile: 'projects/demo/tests/database/db.spec.ts',
  tags: ['@db'],
  layers: ['DATABASE'],
  testType: 'DATABASE_ONLY',
  durationMs: 0,
  skipCategory: 'DATABASE_NOT_CONFIGURED',
  skipReason: 'Database capability is optional and disabled for this project/environment.'
});
const aiPass = contractResult({
  testId: 'ai-healed',
  title: 'AI healed UI journey @ai @ui',
  status: 'passed',
  sourceFile: 'projects/demo/tests/ui/ai.spec.ts',
  tags: ['@ai', '@ui'],
  layers: ['UI'],
  testType: 'UI_ONLY',
  durationMs: 200
});
const knownDefect = contractResult({
  testId: 'known-delete',
  title: 'Delete user @ui',
  status: 'failed',
  sourceFile: 'projects/demo/tests/ui/user.spec.ts',
  tags: ['@ui', '@critical'],
  layers: ['UI'],
  testType: 'UI_ONLY',
  durationMs: 300
});
knownDefect.knownDefect = { id: 'BUG-101', title: 'Delete does not remove user', scope: 'User Management > Delete' };
knownDefect.failureCategory = 'PRODUCT_DEFECT';
knownDefect.error = 'Delete row remained visible.';
knownDefect.stepDetails = [{ title: 'Delete user', category: 'test.step', durationMs: 300, status: 'failed', error: 'Delete row remained visible.', children: [] }];
knownDefect.attachments = [{ name: 'failure-screenshot', contentType: 'image/png', reportPath: 'evidence/failure.png' }];
const healingRecord: HealingAuditRecord = {
  timestamp: new Date().toISOString(), runId: 'run-ai', testId: 'ai-healed', pageUrl: 'https://example.test/users', planId: 'create', businessName: 'Create',
  decision: {
    source: 'ai',
    descriptor: { type: 'role', role: 'button', name: 'Create' },
    confidence: 0.98,
    reason: 'AI candidate validated by semantic post-condition.'
  },
  outcome: 'validated',
  verification: { description: 'Create action completed', passed: true, durationMs: 10 }
};
const aiRecord: AiRuntimeAuditRecord = {
  timestamp: new Date().toISOString(), runId: 'run-ai', testId: 'ai-healed', purpose: 'healing', provider: 'contract', model: 'contract-model', status: 'success', latencyMs: 10
};
const healing: HealingSummary = { count: 1, fallback: 0, cache: 0, ai: 1, affectedTests: 1, records: [healingRecord], attempts: [healingRecord], attemptCount: 1, rejected: 0, suggested: 0, unverified: 0 };

writeReport(root, 'shard-1', [pass, knownDefect]);
const shardEvidence = path.join(root, 'shard-1', 'evidence', 'failure.png');
fs.mkdirSync(path.dirname(shardEvidence), { recursive: true });
fs.writeFileSync(shardEvidence, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlY4QAAAABJRU5ErkJggg==', 'base64'));
writeReport(root, 'shard-2', [dbNa]);
writeReport(root, 'ai', [aiPass], healing, [aiRecord]);
const merged = mergeBusinessReports(root);
assert(merged.total === 4, `expected 4 selected, got ${merged.total}`);
assert(merged.notApplicable === 1, `expected 1 not applicable, got ${merged.notApplicable}`);
assert(merged.executionEligible === 3, `expected 3 applicable, got ${merged.executionEligible}`);
assert(merged.executed === 3, `expected 3 executed, got ${merged.executed}`);
assert(merged.executionRate === 100, `expected 100% execution coverage, got ${merged.executionRate}`);
assert(merged.layerCounts.DATABASE === 0, 'skipped DB must not count as executed database layer');
assert(merged.knownDefects === 1 && merged.qualityFailed === 1 && merged.ciBlockingIssues === 0, 'accepted known defect must remain quality failed but non-blocking after merge');
assert(merged.healing.count === 1 && merged.healing.ai === 1, 'validated AI healing must merge exactly once');
assert(merged.aiUsage?.calls === 1 && merged.aiUsage.healingCalls === 1, 'AI usage must merge exactly once');
assert(merged.aggregation?.mode === 'merged' && merged.aggregation.sourceReports === 3, 'aggregation metadata must identify three sources');
assert(fs.existsSync(path.join(out, 'index.html')), 'merged dashboard must be generated');
const mergedKnown = merged.results.find(result => result.testId === 'known-delete');
const mergedScreenshot = mergedKnown?.attachments?.find(item => item.contentType.startsWith('image/'));
assert(Boolean(mergedScreenshot?.reportPath), 'known-defect failure screenshot must survive shard merge');
assert(fs.existsSync(path.join(out, mergedScreenshot!.reportPath!)), 'merged screenshot file must be materialized into final business bundle');
const mergedHtml = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
assert(mergedHtml.includes('Failure evidence') && mergedHtml.includes('<img'), 'merged failed-step dashboard must render screenshot evidence inline');

const dupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-merge-dup-'));
writeReport(dupRoot, 'a', [pass]);
writeReport(dupRoot, 'b', [pass]);
let duplicateRejected = false;
try { mergeBusinessReports(dupRoot); } catch (error) { duplicateRejected = String(error).includes('Duplicate business scenario'); }
assert(duplicateRejected, 'duplicate test IDs across shard/AI bundles must fail merge');

console.log(JSON.stringify({ ok: true, selected: merged.total, applicable: merged.executionEligible, executed: merged.executed, notApplicable: merged.notApplicable, healing: merged.healing.count, aiCalls: merged.aiUsage?.calls ?? 0, sourceReports: merged.aggregation?.sourceReports }, null, 2));
