import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildExecutionFacts } from '../src/framework/analytics/execution-facts';
import type { AiRuntimeAuditRecord, BusinessTestResult, HealingAuditRecord, HealingSummary } from '../src/framework/analytics/report.types';
import { mergeBusinessReports } from './merge-business-reports';
import { formatBusinessStepSummary } from './ci-business-step-summary';

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
    runId: process.env.RUN_ID ?? `run-${name}`,
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

function writeMarker(root: string, name: string, lane: 'core' | 'ai', shardIndex: number, shardTotal: number, hasTests: boolean | null = true): void {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ci-bundle.json'), JSON.stringify({ schemaVersion: 1, lane, shardIndex, shardTotal, hasTests, application: process.env.APP, environment: process.env.ENV, runId: process.env.RUN_ID }, null, 2));
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
  timestamp: new Date().toISOString(), runId: process.env.RUN_ID ?? 'merged-contract', testId: 'ai-healed', pageUrl: 'https://example.test/users', planId: 'create', businessName: 'Create',
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
  timestamp: new Date().toISOString(), runId: process.env.RUN_ID ?? 'merged-contract', testId: 'ai-healed', purpose: 'healing', provider: 'contract', model: 'contract-model', status: 'success', latencyMs: 10
};
const healing: HealingSummary = { count: 1, fallback: 0, cache: 0, ai: 1, affectedTests: 1, records: [healingRecord], attempts: [healingRecord], attemptCount: 1, rejected: 0, suggested: 0, unverified: 0 };

writeReport(root, 'shard-1', [pass, knownDefect]);
writeMarker(root, 'shard-1', 'core', 1, 2);
const shardEvidence = path.join(root, 'shard-1', 'evidence', 'failure.png');
fs.mkdirSync(path.dirname(shardEvidence), { recursive: true });
fs.writeFileSync(shardEvidence, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlY4QAAAABJRU5ErkJggg==', 'base64'));
writeReport(root, 'shard-2', [dbNa]);
writeMarker(root, 'shard-2', 'core', 2, 2);
writeReport(root, 'ai', [aiPass], healing, [aiRecord]);
writeMarker(root, 'ai', 'ai', 1, 1, true);
process.env.EXPECTED_CORE_WORKERS = '2';
process.env.EXPECT_AI_LANE = 'true';
const merged = mergeBusinessReports(root);
delete process.env.EXPECTED_CORE_WORKERS;
delete process.env.EXPECT_AI_LANE;
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
assert(merged.aggregation?.coreReports === 2 && merged.aggregation.aiReports === 1 && merged.aggregation.aiResults === 1, 'aggregation metadata must distinguish core and AI bundles/results');
const stepSummary = formatBusinessStepSummary(merged);
assert(stepSummary.includes('Aggregated bundles: **3** (core 2, AI 1)') && stepSummary.includes('AI-specific results: **1**') && stepSummary.includes('CI-blocking issues: **0**'), 'GitHub step summary must render deterministic core/AI merged facts');
assert(fs.existsSync(path.join(out, 'index.html')), 'merged dashboard must be generated');
assert(fs.existsSync(history), 'explicit REPORT_HISTORY_FILE override must remain supported');
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

const sequentialRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-merge-sequential-'));
writeReport(sequentialRoot, 'sequential', [pass]);
writeMarker(sequentialRoot, 'sequential', 'core', 1, 1);
const sequential = mergeBusinessReports(sequentialRoot);
assert(sequential.aggregation?.coreReports === 1 && sequential.aggregation.aiReports === 0, 'single sequential report must merge without requiring shard-specific configuration');

// Merge identity must be derivable from validated report facts when a standalone merge command
// is invoked without APP/ENV/RUN_ID in its process environment. This protects downloaded CI bundles
// and manual merge workflows from depending on mutable workspace/latest-run state.
const fallbackIdentityRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-merge-identity-fallback-'));
writeReport(fallbackIdentityRoot, 'core', [contractResult({ testId: 'identity-fallback', title: 'Identity fallback', status: 'passed', sourceFile: 'projects/demo/tests/ui/identity.spec.ts', tags: ['@ui'], layers: ['UI'], testType: 'UI_ONLY', durationMs: 10 })]);
writeMarker(fallbackIdentityRoot, 'core', 'core', 1, 1);
const savedIdentityEnv = { APP: process.env.APP, ENV: process.env.ENV, RUN_ID: process.env.RUN_ID, MERGED: process.env.MERGED_BUSINESS_REPORT_DIR, HISTORY: process.env.REPORT_HISTORY_FILE };
delete process.env.APP;
delete process.env.ENV;
delete process.env.RUN_ID;
process.env.MERGED_BUSINESS_REPORT_DIR = path.join(fallbackIdentityRoot, 'merged-output');
process.env.REPORT_HISTORY_FILE = path.join(fallbackIdentityRoot, 'history.json');
const fallbackIdentityMerged = mergeBusinessReports(fallbackIdentityRoot);
assert(fallbackIdentityMerged.application === 'demo' && fallbackIdentityMerged.environment === 'qa' && fallbackIdentityMerged.runId === 'merged-contract', 'merge must derive APP/ENV/RUN_ID from report facts when environment identity is absent');
if (savedIdentityEnv.APP === undefined) delete process.env.APP; else process.env.APP = savedIdentityEnv.APP;
if (savedIdentityEnv.ENV === undefined) delete process.env.ENV; else process.env.ENV = savedIdentityEnv.ENV;
if (savedIdentityEnv.RUN_ID === undefined) delete process.env.RUN_ID; else process.env.RUN_ID = savedIdentityEnv.RUN_ID;
if (savedIdentityEnv.MERGED === undefined) delete process.env.MERGED_BUSINESS_REPORT_DIR; else process.env.MERGED_BUSINESS_REPORT_DIR = savedIdentityEnv.MERGED;
if (savedIdentityEnv.HISTORY === undefined) delete process.env.REPORT_HISTORY_FILE; else process.env.REPORT_HISTORY_FILE = savedIdentityEnv.HISTORY;


const overshardRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-merge-overshard-'));
writeReport(overshardRoot, 'core-1', [pass]);
writeMarker(overshardRoot, 'core-1', 'core', 1, 2, true);
writeMarker(overshardRoot, 'core-2', 'core', 2, 2, false);
process.env.EXPECTED_CORE_WORKERS = '2';
const overshardMerged = mergeBusinessReports(overshardRoot);
delete process.env.EXPECTED_CORE_WORKERS;
assert(overshardMerged.aggregation?.coreReports === 1 && overshardMerged.total === 1, 'an intentionally empty over-sharded worker must not require a fake business report');

const zeroSelectionRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-merge-zero-selection-'));
writeMarker(zeroSelectionRoot, 'core-1', 'core', 1, 2, false);
writeMarker(zeroSelectionRoot, 'core-2', 'core', 2, 2, false);
process.env.EXPECTED_CORE_WORKERS = '2';
let zeroSelectionRejected = false;
try { mergeBusinessReports(zeroSelectionRoot); } catch (error) { zeroSelectionRejected = String(error).includes('No core business scenarios were selected'); }
delete process.env.EXPECTED_CORE_WORKERS;
assert(zeroSelectionRejected, 'all core workers selecting zero business tests must fail with an actionable profile/tagging error');

const missingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-merge-missing-'));
writeReport(missingRoot, 'core-1', [pass]);
writeMarker(missingRoot, 'core-1', 'core', 1, 2);
writeReport(missingRoot, 'ai', [aiPass], healing, [aiRecord]);
writeMarker(missingRoot, 'ai', 'ai', 1, 1, true);
process.env.EXPECTED_CORE_WORKERS = '2';
process.env.EXPECT_AI_LANE = 'true';
let missingShardRejected = false;
try { mergeBusinessReports(missingRoot); } catch (error) { missingShardRejected = String(error).includes('Incomplete CI core marker topology'); }
delete process.env.EXPECTED_CORE_WORKERS;
delete process.env.EXPECT_AI_LANE;
assert(missingShardRejected, 'AI report must never satisfy a missing core shard count');

const aiMissingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-merge-ai-missing-'));
writeReport(aiMissingRoot, 'core', [pass]);
writeMarker(aiMissingRoot, 'core', 'core', 1, 1);
writeMarker(aiMissingRoot, 'ai', 'ai', 1, 1, true);
process.env.EXPECTED_CORE_WORKERS = '1';
process.env.EXPECT_AI_LANE = 'true';
let missingAiRejected = false;
try { mergeBusinessReports(aiMissingRoot); } catch (error) { missingAiRejected = String(error).includes('AI tests were detected but the AI lane artifact does not contain business-report.json'); }
delete process.env.EXPECTED_CORE_WORKERS;
delete process.env.EXPECT_AI_LANE;
assert(missingAiRejected, 'planned AI lane with detected tests must fail when its business report is missing');

const aiEmptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-merge-ai-empty-'));
writeReport(aiEmptyRoot, 'core', [pass]);
writeMarker(aiEmptyRoot, 'core', 'core', 1, 1);
writeReport(aiEmptyRoot, 'ai', [contractResult({ testId: 'not-ai', title: 'Non AI result', status: 'passed', sourceFile: 'projects/demo/tests/ui/plain.spec.ts', tags: ['@ui'], layers: ['UI'], testType: 'UI_ONLY', durationMs: 10 })]);
writeMarker(aiEmptyRoot, 'ai', 'ai', 1, 1, true);
process.env.EXPECTED_CORE_WORKERS = '1';
process.env.EXPECT_AI_LANE = 'true';
let emptyAiRejected = false;
try { mergeBusinessReports(aiEmptyRoot); } catch (error) { emptyAiRejected = String(error).includes('contains no @ai-specific result'); }
delete process.env.EXPECTED_CORE_WORKERS;
delete process.env.EXPECT_AI_LANE;
assert(emptyAiRejected, 'AI lane with detected tests must contain at least one @ai business result');

const aiNotApplicableRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-merge-ai-na-'));
writeReport(aiNotApplicableRoot, 'core', [pass]);
writeMarker(aiNotApplicableRoot, 'core', 'core', 1, 1);
writeMarker(aiNotApplicableRoot, 'ai', 'ai', 1, 1, false);
process.env.EXPECTED_CORE_WORKERS = '1';
process.env.EXPECT_AI_LANE = 'true';
const aiNotApplicable = mergeBusinessReports(aiNotApplicableRoot);
delete process.env.EXPECTED_CORE_WORKERS;
delete process.env.EXPECT_AI_LANE;
assert(aiNotApplicable.aggregation?.aiReports === 0 && aiNotApplicable.aggregation.aiResults === 0, 'AI lane with no @ai tests must be recorded as not applicable rather than treated as missing');

const mixedIdentityRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-merge-cross-run-'));
writeReport(mixedIdentityRoot, 'current', [pass]);
const priorRunId = process.env.RUN_ID;
process.env.RUN_ID = 'foreign-run';
writeReport(mixedIdentityRoot, 'foreign', [contractResult({ testId: 'foreign', title: 'Foreign run result', status: 'passed', sourceFile: 'projects/demo/tests/ui/foreign.spec.ts', tags: ['@ui'], layers: ['UI'], testType: 'UI_ONLY', durationMs: 10 })]);
process.env.RUN_ID = priorRunId;
let crossRunRejected = false;
try { mergeBusinessReports(mixedIdentityRoot); } catch (error) { crossRunRejected = String(error).includes('Cross-execution business merge blocked'); }
assert(crossRunRejected, 'business merge must reject artifacts from another run even when application/environment match');

// GitHub failed-job reruns may legitimately combine unchanged successful shards from an earlier attempt
// with a rerun shard/AI lane from the current attempt. This is allowed only for the same workflow run.
const priorAttemptRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-merge-prior-attempt-'));
process.env.RUN_ID = '90001-2';
process.env.CI_ALLOW_SAME_WORKFLOW_PRIOR_ATTEMPTS = 'true';
process.env.CI_WORKFLOW_RUN_ID = '90001';
process.env.CI_WORKFLOW_RUN_ATTEMPT = '2';
process.env.EXPECTED_CORE_WORKERS = '2';
writeReport(priorAttemptRoot, 'core-current', [contractResult({ testId: 'current-shard', title: 'Current shard', status: 'passed', sourceFile: 'projects/demo/tests/ui/current.spec.ts', tags: ['@ui'], layers: ['UI'], testType: 'UI_ONLY', durationMs: 10 })]);
writeMarker(priorAttemptRoot, 'core-current', 'core', 1, 2, true);
process.env.RUN_ID = '90001-1';
writeReport(priorAttemptRoot, 'core-prior', [contractResult({ testId: 'prior-shard', title: 'Prior shard', status: 'passed', sourceFile: 'projects/demo/tests/ui/prior.spec.ts', tags: ['@ui'], layers: ['UI'], testType: 'UI_ONLY', durationMs: 10 })]);
writeMarker(priorAttemptRoot, 'core-prior', 'core', 2, 2, true);
process.env.RUN_ID = '90001-2';
const priorAttemptMerged = mergeBusinessReports(priorAttemptRoot);
assert(priorAttemptMerged.runId === '90001-2', 'merged rerun report must use the current attempt as its publication identity');
assert(priorAttemptMerged.aggregation?.sourceRunIds.includes('90001-1') && priorAttemptMerged.aggregation?.sourceRunIds.includes('90001-2'), 'merged rerun report must disclose all source attempt identities');
delete process.env.CI_ALLOW_SAME_WORKFLOW_PRIOR_ATTEMPTS;
delete process.env.CI_WORKFLOW_RUN_ID;
delete process.env.CI_WORKFLOW_RUN_ATTEMPT;
delete process.env.EXPECTED_CORE_WORKERS;
process.env.RUN_ID = 'merged-contract';

console.log(JSON.stringify({ ok: true, selected: merged.total, applicable: merged.executionEligible, executed: merged.executed, notApplicable: merged.notApplicable, healing: merged.healing.count, aiCalls: merged.aiUsage?.calls ?? 0, aiResults: merged.aggregation?.aiResults ?? 0, coreReports: merged.aggregation?.coreReports ?? 0, aiReports: merged.aggregation?.aiReports ?? 0, sourceReports: merged.aggregation?.sourceReports }, null, 2));
