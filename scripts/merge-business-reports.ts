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
  if (!files.length) throw new Error(`No business-report.json files found under ${root}`);

  const reports: LocatedReport[] = files.map(file => {
    const directory = path.dirname(file);
    const facts = JSON.parse(fs.readFileSync(file, 'utf8')) as ExecutionFacts;
    const marker = findMarkerForDirectory(directory, markers)?.marker;
    return { file, directory, facts, marker, lane: marker?.lane ?? inferLaneFromFacts(facts) };
  });

  enforceBundleTopology(reports, markers);

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

  const first = reports[0].facts;
  const mergedResults = [...uniqueResults.values()];
  const merged = buildExecutionFacts({
    runId: process.env.RUN_ID ?? first.runId,
    environment: first.environment,
    application: first.application,
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

  const history = new ReportHistoryStore().append(merged);
  const outputDir = path.resolve(process.env.MERGED_BUSINESS_REPORT_DIR ?? path.join(ProjectPaths.reports(), 'business-merged'));
  fs.rmSync(outputDir, { recursive: true, force: true });
  const written = writeBusinessDashboard(outputDir, merged, { history, reportUrl: cleanEnv('REPORT_PUBLIC_URL') });
  console.log(`Merged ${files.length} business report bundle(s) (${coreReports} core, ${aiReports} AI) into ${path.join(outputDir, 'index.html')}`);
  console.log(`Merged business scenarios: ${written.total} selected; ${written.executed}/${written.executionEligible} applicable scenarios executed; ${aiResults} AI-specific result(s); ${written.healing.count} validated healing event(s); ${written.aiUsage?.calls ?? 0} AI runtime call(s).`);
  return written;
}

function enforceBundleTopology(reports: LocatedReport[], markers: LocatedMarker[]): void {
  const coreReports = reports.filter(report => report.lane === 'core');
  const aiReports = reports.filter(report => report.lane === 'ai');
  const expectedCore = positiveIntegerEnv('EXPECTED_CORE_REPORTS') ?? positiveIntegerEnv('EXPECTED_BUSINESS_REPORTS');
  const expectedAi = nonNegativeIntegerEnv('EXPECTED_AI_REPORTS');
  const expectAiLane = booleanEnv('EXPECT_AI_LANE');

  if (expectedCore !== undefined && coreReports.length < expectedCore) {
    throw new Error(`Incomplete CI core business merge: expected at least ${expectedCore} core report bundle(s), found ${coreReports.length}. A sequential/shard artifact may be missing.`);
  }
  if (expectedAi !== undefined && aiReports.length < expectedAi) {
    throw new Error(`Incomplete CI AI business merge: expected at least ${expectedAi} AI report bundle(s), found ${aiReports.length}. The dedicated AI artifact may be missing.`);
  }

  const coreMarkers = markers.filter(item => item.marker.lane === 'core');
  if (expectedCore !== undefined && coreMarkers.length > 0) {
    const identities = new Set(coreMarkers.map(item => `${item.marker.shardIndex}/${item.marker.shardTotal}`));
    if (identities.size < expectedCore) {
      throw new Error(`Incomplete CI core marker topology: expected ${expectedCore} unique core lane marker(s), found ${identities.size}.`);
    }
    for (const marker of coreMarkers) {
      if (!hasReportInDirectory(marker.directory)) {
        throw new Error(`Core CI bundle ${marker.marker.shardIndex}/${marker.marker.shardTotal} was uploaded without business-report.json.`);
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
