import fs from 'node:fs';
import path from 'node:path';
import { ProjectPaths } from '../src/framework/core/config/project.paths';
import { buildExecutionFacts } from '../src/framework/analytics/execution-facts';
import type { AiRuntimeAuditRecord, AiRuntimeUsageSummary, BusinessAttachment, BusinessTestResult, ExecutionFacts, HealingAuditRecord, HealingSummary } from '../src/framework/analytics/report.types';
import { writeBusinessDashboard } from '../src/framework/reporting/business-dashboard.writer';
import { ReportHistoryStore } from '../src/framework/reporting/report-history.store';

type ReportLane = 'core' | 'ai';

interface CiBundleMarker {
  schemaVersion: 1;
  lane: ReportLane;
  shardIndex: number;
  shardTotal: number;
  hasTests?: boolean | null;
  application?: string;
  environment?: string;
  runId?: string;
}

interface LocatedReport {
  file: string;
  directory: string;
  facts: ExecutionFacts;
  lane: ReportLane;
  marker?: CiBundleMarker;
}

interface LocatedMarker {
  file: string;
  directory: string;
  marker: CiBundleMarker;
}

/**
 * Author: Raushan Raj
 * Business Use: Merges sequential, sharded and optional AI CI business facts into one complete stakeholder dashboard.
 * How to use: Download every core/AI business artifact beneath all-business-reports and run report:merge:business.
 * Benefit: Validates core-shard completeness independently from the AI lane, prevents AI bundles from masking a missing shard, and preserves evidence across workers.
 */
export function mergeBusinessReports(rootInput = process.argv[2] ?? 'all-business-reports'): ExecutionFacts {
  const root = path.resolve(rootInput);
  const markers = locateBundleMarkers(root);
  const files = walk(root).filter(file => path.basename(file) === 'business-report.json');

  const reports: LocatedReport[] = files.map(file => {
    const directory = path.dirname(file);
    const facts = JSON.parse(fs.readFileSync(file, 'utf8')) as ExecutionFacts;
    const marker = findMarkerForDirectory(directory, markers)?.marker;
    return { file, directory, facts, marker, lane: marker?.lane ?? inferLaneFromFacts(facts) };
  });

  enforceBundleTopology(reports, markers);
  if (!reports.length) throw new Error(`No business-report.json files found under ${root}`);
  const executionIdentity = enforceExecutionIdentity(reports, markers);

  const uniqueResults = new Map<string, BusinessTestResult>();
  const healingByKey = new Map<string, HealingAuditRecord>();
  const aiByKey = new Map<string, AiRuntimeAuditRecord>();

  for (const located of reports) {
    for (const result of located.facts.results) {
      const rebased = rebaseShardEvidence(result, located.directory);
      const key = `${rebased.project}:${rebased.testId}`;
      const existing = uniqueResults.get(key);
      if (existing) {
        throw new Error(`Duplicate business scenario across CI report bundles: ${key}. Ensure normal shards exclude dedicated AI tests and each shard executes a scenario once.`);
      }
      uniqueResults.set(key, rebased);
    }
    for (const record of located.facts.healing.attempts ?? located.facts.healing.records) {
      healingByKey.set(`${record.runId}:${record.testId ?? ''}:${record.planId}:${record.timestamp}:${record.decision.source}:${record.outcome ?? 'validated'}`, record);
    }
    for (const record of located.facts.aiUsage?.records ?? []) {
      aiByKey.set(`${record.runId}:${record.testId ?? ''}:${record.timestamp}:${record.purpose}:${record.provider ?? ''}:${record.model ?? ''}`, record);
    }
  }

  const healingAttempts = [...healingByKey.values()];
  const outcome = (record: HealingAuditRecord) => record.outcome ?? 'validated';
  const healingRecords = healingAttempts.filter(record => outcome(record) === 'validated');
  const healing: HealingSummary = {
    count: healingRecords.length,
    fallback: healingRecords.filter(record => record.decision.source === 'fallback').length,
    cache: healingRecords.filter(record => record.decision.source === 'cache').length,
    ai: healingRecords.filter(record => record.decision.source === 'ai').length,
    affectedTests: new Set(healingRecords.map(record => record.testId).filter(Boolean)).size,
    records: healingRecords,
    attempts: healingAttempts,
    attemptCount: healingAttempts.length,
    rejected: healingAttempts.filter(record => outcome(record) === 'rejected').length,
    suggested: healingAttempts.filter(record => outcome(record) === 'suggested').length,
    unverified: healingAttempts.filter(record => outcome(record) === 'unverified').length
  };

  const aiUsage = buildAiUsageSummary([...aiByKey.values()]);

  const mergedResults = [...uniqueResults.values()];
  const merged = buildExecutionFacts({
    runId: executionIdentity.runId,
    environment: executionIdentity.environment,
    application: executionIdentity.application,
    results: mergedResults,
    healing,
    aiUsage,
    scope: {
      excludedInternalTests: reports.reduce((sum, report) => sum + (report.facts.scope?.excludedInternalTests ?? 0), 0),
      internalTestsIncluded: reports.some(report => report.facts.scope?.internalTestsIncluded === true)
    }
  });

  const coreReports = reports.filter(report => report.lane === 'core').length;
  const aiReports = reports.filter(report => report.lane === 'ai').length;
  const aiResults = mergedResults.filter(result => result.tags.some(tag => tag.toLowerCase() === '@ai')).length;
  merged.aggregation = {
    mode: 'merged',
    sourceReports: reports.length,
    coreReports,
    aiReports,
    aiResults,
    sourceRunIds: [...new Set(reports.map(report => report.facts.runId))].sort(),
    sourceDirectories: reports.map(report => path.relative(root, report.directory) || '.').sort()
  };

  const historyFile = path.resolve(process.env.REPORT_HISTORY_FILE ?? path.join('.report-history', executionIdentity.application, executionIdentity.environment, 'business-history.json'));
  const history = new ReportHistoryStore(historyFile).append(merged);
  const outputDir = path.resolve(
    process.env.MERGED_BUSINESS_REPORT_DIR
      ?? path.join(ProjectPaths.reports(executionIdentity.application, executionIdentity.environment, executionIdentity.runId), 'business-merged')
  );
  fs.rmSync(outputDir, { recursive: true, force: true });
  const written = writeBusinessDashboard(outputDir, merged, { history, reportUrl: cleanEnv('REPORT_PUBLIC_URL') });
  console.log(`Merged ${files.length} business report bundle(s) (${coreReports} core, ${aiReports} AI) into ${path.join(outputDir, 'index.html')}`);
  console.log(`Merged business scenarios: ${written.total} selected; ${written.executed}/${written.executionEligible} applicable scenarios executed; ${aiResults} AI-specific result(s); ${written.healing.count} validated healing event(s); ${written.aiUsage?.calls ?? 0} AI runtime call(s).`);
  return written;
}


function enforceExecutionIdentity(reports: LocatedReport[], markers: LocatedMarker[]): { application: string; environment: string; runId: string } {
  if (!reports.length) throw new Error('Cannot validate execution identity without business reports.');
  const first = reports[0]!.facts;
  const expected = {
    application: cleanEnv('APP') ?? first.application,
    environment: cleanEnv('ENV') ?? first.environment,
    runId: cleanEnv('RUN_ID') ?? first.runId
  };
  for (const [field, value] of Object.entries(expected)) {
    if (!String(value ?? '').trim()) throw new Error(`Business report execution identity is missing '${field}'.`);
  }

  for (const report of reports) {
    const actual = { application: report.facts.application, environment: report.facts.environment, runId: report.facts.runId };
    for (const field of ['application', 'environment', 'runId'] as const) {
      if (actual[field] !== expected[field]) {
        const allowedPriorAttempt = field === 'runId' && isAllowedPriorAttemptRunId(actual[field], expected.runId);
        if (!allowedPriorAttempt) {
          throw new Error(`Cross-execution business merge blocked: ${path.relative(process.cwd(), report.file)} has ${field}='${actual[field]}' but expected '${expected[field]}'. Never merge artifacts from different applications, environments or workflow runs.`);
        }
      }
    }
    for (const record of report.facts.healing?.attempts ?? report.facts.healing?.records ?? []) {
      if (record.runId && record.runId !== expected.runId && !isAllowedPriorAttemptRunId(record.runId, expected.runId)) {
        throw new Error(`Cross-execution healing evidence blocked: ${path.relative(process.cwd(), report.file)} contains runId='${record.runId}' but expected '${expected.runId}' or a verified prior attempt from the same workflow run.`);
      }
    }
    for (const record of report.facts.aiUsage?.records ?? []) {
      if (record.runId && record.runId !== expected.runId && !isAllowedPriorAttemptRunId(record.runId, expected.runId)) {
        throw new Error(`Cross-execution AI evidence blocked: ${path.relative(process.cwd(), report.file)} contains runId='${record.runId}' but expected '${expected.runId}' or a verified prior attempt from the same workflow run.`);
      }
    }
  }

  for (const located of markers) {
    const marker = located.marker;
    for (const field of ['application', 'environment', 'runId'] as const) {
      const value = marker[field];
      if (value !== undefined && value !== expected[field]) {
        const allowedPriorAttempt = field === 'runId' && isAllowedPriorAttemptRunId(value, expected.runId);
        if (!allowedPriorAttempt) {
          throw new Error(`Cross-execution CI marker blocked: ${path.relative(process.cwd(), located.file)} has ${field}='${value}' but expected '${expected[field]}'.`);
        }
      }
    }
  }
  return expected;
}

function isAllowedPriorAttemptRunId(actual: string | undefined, expectedCurrentRunId: string): boolean {
  if (process.env.CI_ALLOW_SAME_WORKFLOW_PRIOR_ATTEMPTS !== 'true' || !actual) return false;
  const workflowRunId = cleanEnv('CI_WORKFLOW_RUN_ID');
  const currentAttemptRaw = cleanEnv('CI_WORKFLOW_RUN_ATTEMPT');
  if (!workflowRunId || !currentAttemptRaw) return false;
  const currentAttempt = Number(currentAttemptRaw);
  if (!Number.isInteger(currentAttempt) || currentAttempt < 1) return false;
  if (expectedCurrentRunId !== `${workflowRunId}-${currentAttempt}`) return false;
  const prefix = `${workflowRunId}-`;
  if (!actual.startsWith(prefix)) return false;
  const attemptRaw = actual.slice(prefix.length);
  const attempt = Number(attemptRaw);
  return Number.isInteger(attempt) && attempt >= 1 && attempt <= currentAttempt && String(attempt) === attemptRaw;
}

function enforceBundleTopology(reports: LocatedReport[], markers: LocatedMarker[]): void {
  const coreReports = reports.filter(report => report.lane === 'core');
  const aiReports = reports.filter(report => report.lane === 'ai');
  const expectedCoreWorkers = positiveIntegerEnv('EXPECTED_CORE_WORKERS')
    ?? positiveIntegerEnv('EXPECTED_CORE_REPORTS')
    ?? positiveIntegerEnv('EXPECTED_BUSINESS_REPORTS');
  const expectedAi = nonNegativeIntegerEnv('EXPECTED_AI_REPORTS');
  const expectAiLane = booleanEnv('EXPECT_AI_LANE');

  if (expectedAi !== undefined && aiReports.length < expectedAi) {
    throw new Error(`Incomplete CI AI business merge: expected at least ${expectedAi} AI report bundle(s), found ${aiReports.length}. The dedicated AI artifact may be missing.`);
  }

  const coreMarkers = markers.filter(item => item.marker.lane === 'core');
  if (expectedCoreWorkers !== undefined) {
    if (!coreMarkers.length) {
      // Backward-compatible fallback for older artifacts that predate topology markers.
      if (coreReports.length < expectedCoreWorkers) {
        throw new Error(`Incomplete CI core business merge: expected ${expectedCoreWorkers} core worker/report bundle(s), found ${coreReports.length}. Core topology markers were not available.`);
      }
    } else {
      const identities = new Set(coreMarkers.map(item => `${item.marker.shardIndex}/${item.marker.shardTotal}`));
      if (identities.size < expectedCoreWorkers) {
        throw new Error(`Incomplete CI core marker topology: expected ${expectedCoreWorkers} unique core worker marker(s), found ${identities.size}.`);
      }
      const selectedMarkers = coreMarkers.filter(item => item.marker.hasTests === true);
      const unknownMarkers = coreMarkers.filter(item => item.marker.hasTests === null || item.marker.hasTests === undefined);
      if (unknownMarkers.length) {
        throw new Error(`Core CI bundle marker(s) do not declare whether business tests were selected: ${unknownMarkers.map(item => `${item.marker.shardIndex}/${item.marker.shardTotal}`).join(', ')}.`);
      }
      if (!selectedMarkers.length) {
        throw new Error(`No core business scenarios were selected across ${expectedCoreWorkers} worker(s). Check TEST_PROFILE, grep filters and project tags before publishing an empty report.`);
      }
      for (const marker of selectedMarkers) {
        if (!hasReportInDirectory(marker.directory)) {
          throw new Error(`Core CI bundle ${marker.marker.shardIndex}/${marker.marker.shardTotal} selected tests but was uploaded without business-report.json.`);
        }
      }
      if (coreReports.length < selectedMarkers.length) {
        throw new Error(`Incomplete CI core business merge: ${selectedMarkers.length} worker(s) selected tests but only ${coreReports.length} core business report bundle(s) were found.`);
      }
    }
  }

  if (expectAiLane) {
    const aiMarkers = markers.filter(item => item.marker.lane === 'ai');
    if (!aiMarkers.length) {
      throw new Error('AI lane was planned but no AI CI bundle marker was downloaded.');
    }
    const aiMarker = aiMarkers[0];
    if (aiMarker.marker.hasTests === null || aiMarker.marker.hasTests === undefined) {
      throw new Error('AI lane marker does not declare whether @ai tests were detected.');
    }
    if (aiMarker.marker.hasTests) {
      if (!hasReportInDirectory(aiMarker.directory)) {
        throw new Error('AI tests were detected but the AI lane artifact does not contain business-report.json.');
      }
      const aiSpecificResults = aiReports.flatMap(report => report.facts.results).filter(result => result.tags.some(tag => tag.toLowerCase() === '@ai'));
      if (!aiSpecificResults.length) {
        throw new Error('AI tests were detected but the merged AI business bundle contains no @ai-specific result.');
      }
    }
  }
}

function locateBundleMarkers(root: string): LocatedMarker[] {
  return walk(root)
    .filter(file => path.basename(file) === 'ci-bundle.json')
    .map(file => ({ file, directory: path.dirname(file), marker: parseMarker(file) }));
}

function parseMarker(file: string): CiBundleMarker {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<CiBundleMarker>;
  if (raw.schemaVersion !== 1 || (raw.lane !== 'core' && raw.lane !== 'ai')) {
    throw new Error(`Invalid CI bundle marker: ${file}`);
  }
  const shardIndex = Number(raw.shardIndex);
  const shardTotal = Number(raw.shardTotal);
  if (!Number.isInteger(shardIndex) || !Number.isInteger(shardTotal) || shardIndex < 1 || shardTotal < 1 || shardIndex > shardTotal) {
    throw new Error(`Invalid CI bundle shard identity in ${file}`);
  }
  return { ...raw, schemaVersion: 1, lane: raw.lane, shardIndex, shardTotal, hasTests: raw.hasTests ?? null };
}

function findMarkerForDirectory(directory: string, markers: LocatedMarker[]): LocatedMarker | undefined {
  return markers.find(marker => marker.directory === directory);
}

function inferLaneFromFacts(facts: ExecutionFacts): ReportLane {
  const results = facts.results ?? [];
  return results.length > 0 && results.every(result => result.tags.some(tag => tag.toLowerCase() === '@ai')) ? 'ai' : 'core';
}

function hasReportInDirectory(directory: string): boolean {
  return fs.existsSync(path.join(directory, 'business-report.json'));
}

function positiveIntegerEnv(name: string): number | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer, received '${raw}'.`);
  return value;
}

function nonNegativeIntegerEnv(name: string): number | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer, received '${raw}'.`);
  return value;
}

function booleanEnv(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return false;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} must be true or false, received '${process.env[name]}'.`);
}

function buildAiUsageSummary(records: AiRuntimeAuditRecord[]): AiRuntimeUsageSummary {
  const providerMap = new Map<string, { calls: number; models: Set<string> }>();
  for (const record of records) {
    if (!record.provider) continue;
    const current = providerMap.get(record.provider) ?? { calls: 0, models: new Set<string>() };
    current.calls += 1;
    if (record.model) current.models.add(record.model);
    providerMap.set(record.provider, current);
  }
  const latencies = records.map(record => record.latencyMs).filter((value): value is number => typeof value === 'number');
  return {
    calls: records.length,
    healingCalls: records.filter(record => record.purpose === 'healing').length,
    reportingCalls: records.filter(record => record.purpose === 'reporting').length,
    successfulCalls: records.filter(record => record.status === 'success').length,
    noResultCalls: records.filter(record => record.status === 'no-result').length,
    errorCalls: records.filter(record => record.status === 'error').length,
    budgetBlockedCalls: records.filter(record => record.status === 'budget-blocked').length,
    averageLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : 0,
    providers: [...providerMap.entries()].map(([provider, value]) => ({ provider, calls: value.calls, models: [...value.models].sort() })),
    records
  };
}

function rebaseShardEvidence(result: BusinessTestResult, shardReportDir: string): BusinessTestResult {
  const clone = JSON.parse(JSON.stringify(result)) as BusinessTestResult;
  clone.attachments = (clone.attachments ?? []).map(attachment => rebaseAttachment(attachment, shardReportDir));
  return clone;
}

function rebaseAttachment(attachment: BusinessAttachment, shardReportDir: string): BusinessAttachment {
  const output: BusinessAttachment = { ...attachment };
  if (attachment.reportPath) {
    const candidate = path.resolve(shardReportDir, attachment.reportPath);
    if (fs.existsSync(candidate)) output.sourcePath = candidate;
  }
  if ((!output.sourcePath || !fs.existsSync(output.sourcePath)) && attachment.sourcePath) {
    const relativeCandidate = path.resolve(shardReportDir, attachment.sourcePath);
    if (fs.existsSync(relativeCandidate)) output.sourcePath = relativeCandidate;
  }
  delete output.reportPath;
  return output;
}

function cleanEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith('$(')) return undefined;
  return value;
}

function walk(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const output: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...walk(full)); else output.push(full);
  }
  return output;
}

if (require.main === module) mergeBusinessReports();
