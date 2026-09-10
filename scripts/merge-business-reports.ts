import fs from 'node:fs';
import path from 'node:path';
import { ProjectPaths } from '../src/framework/core/config/project.paths';
import { buildExecutionFacts } from '../src/framework/analytics/execution-facts';
import type { AiRuntimeAuditRecord, AiRuntimeUsageSummary, BusinessAttachment, BusinessTestResult, ExecutionFacts, HealingAuditRecord, HealingSummary } from '../src/framework/analytics/report.types';
import { writeBusinessDashboard } from '../src/framework/reporting/business-dashboard.writer';
import { ReportHistoryStore } from '../src/framework/reporting/report-history.store';

interface LocatedReport { file: string; directory: string; facts: ExecutionFacts }

/**
 * Author: Raushan Raj
 * Business Use: Merges parallel CI shard facts and evidence into one complete stakeholder dashboard.
 * How to use: Download each shard's reports/<APP>/business directory beneath all-business-reports and run report:merge:business.
 * Benefit: Screenshots/traces/text evidence survive worker boundaries instead of becoming broken links after report merge.
 */
function main(): void {
  const root = path.resolve(process.argv[2] ?? 'all-business-reports');
  const files = walk(root).filter(file => path.basename(file) === 'business-report.json');
  if (!files.length) throw new Error(`No business-report.json files found under ${root}`);

  const reports: LocatedReport[] = files.map(file => ({
    file,
    directory: path.dirname(file),
    facts: JSON.parse(fs.readFileSync(file, 'utf8')) as ExecutionFacts
  }));

  const uniqueResults = new Map<string, BusinessTestResult>();
  const healingByKey = new Map<string, HealingAuditRecord>();
  const aiByKey = new Map<string, AiRuntimeAuditRecord>();

  for (const located of reports) {
    for (const result of located.facts.results) {
      const rebased = rebaseShardEvidence(result, located.directory);
      uniqueResults.set(`${rebased.project}:${rebased.testId}`, rebased);
    }
    for (const record of located.facts.healing.records) {
      healingByKey.set(`${record.runId}:${record.testId ?? ''}:${record.planId}:${record.timestamp}:${record.decision.source}`, record);
    }
    for (const record of located.facts.aiUsage?.records ?? []) {
      aiByKey.set(`${record.runId}:${record.testId ?? ''}:${record.timestamp}:${record.purpose}:${record.provider ?? ''}:${record.model ?? ''}`, record);
    }
  }

  const healingRecords = [...healingByKey.values()];
  const healing: HealingSummary = {
    count: healingRecords.length,
    fallback: healingRecords.filter(record => record.decision.source === 'fallback').length,
    cache: healingRecords.filter(record => record.decision.source === 'cache').length,
    ai: healingRecords.filter(record => record.decision.source === 'ai').length,
    affectedTests: new Set(healingRecords.map(record => record.testId).filter(Boolean)).size,
    records: healingRecords
  };

  const aiUsage = buildAiUsageSummary([...aiByKey.values()]);

  const first = reports[0].facts;
  const merged = buildExecutionFacts({
    runId: process.env.RUN_ID ?? first.runId,
    environment: first.environment,
    application: first.application,
    results: [...uniqueResults.values()],
    healing,
    aiUsage,
    scope: {
      excludedInternalTests: reports.reduce((sum, report) => sum + (report.facts.scope?.excludedInternalTests ?? 0), 0),
      internalTestsIncluded: reports.some(report => report.facts.scope?.internalTestsIncluded === true)
    }
  });

  // CI restores .report-history before this command and this is the only place that appends the final merged release point.
  const history = new ReportHistoryStore().append(merged);
  const outputDir = path.resolve(process.env.MERGED_BUSINESS_REPORT_DIR ?? path.join(ProjectPaths.reports(), 'business-merged'));
  fs.rmSync(outputDir, { recursive: true, force: true });
  writeBusinessDashboard(outputDir, merged, { history, reportUrl: cleanEnv('REPORT_PUBLIC_URL') });
  console.log(`Merged ${files.length} shard business report(s) into ${path.join(outputDir, 'index.html')}`);
  console.log(`Merged business scenarios: ${merged.total}; evidence links retained where shard artifacts contained the files.`);
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

main();
