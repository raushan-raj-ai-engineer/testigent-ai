import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult, TestStep } from '@playwright/test/reporter';
import { classifyFailure } from '../ai/failure.classifier';
import { buildExecutionFacts } from '../analytics/execution-facts';
import type { AiRuntimeAuditRecord, AiRuntimeUsageSummary, BusinessAttachment, BusinessAttempt, BusinessStepDetail, BusinessTestResult, HealingAuditRecord, HealingSummary } from '../analytics/report.types';
import { classifyTestLayers } from '../analytics/test-layer.classifier';
import { RunContext } from '../core/config/run.context';
import { ProjectPaths } from '../core/config/project.paths';
import { shouldIncludeInBusinessReport } from './business-report-scope';
import { writeBusinessDashboard } from './business-dashboard.writer';
import { ReportHistoryStore } from './report-history.store';
import { classifySkipReason } from './skip-reason.classifier';

interface MutableBusinessTest {
  testId: string;
  title: string;
  project: string;
  tags: string[];
  sourceFile?: string;
  attempts: BusinessAttempt[];
  lastSteps: string[];
  lastStepDetails: BusinessStepDetail[];
  lastAttachments: BusinessAttachment[];
  lastError?: string;
  annotations: Array<{ type: string; description?: string }>;
}

/**
 * Author: Raushan Raj
 * Business Use: Produces one stakeholder dashboard from final product/business scenarios while preserving optional step-level drill-down.
 * How to use: Keep configured as a Playwright reporter. Use `test.step()` for business journeys; attachments automatically become evidence links when safe to copy.
 * Benefit: Executives see release KPIs first, while QA/engineering can expand the same scenario to inspect step duration, failure point and evidence.
 */
export default class BusinessReporter implements Reporter {
  private readonly attempts = new Map<string, MutableBusinessTest>();
  private readonly excludedInternal = new Set<string>();
  private readonly outputDir: string;

  constructor(options: { outputDir?: string } = {}) {
    this.outputDir = path.resolve(options.outputDir ?? ProjectPaths.businessReport());
  }

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.attempts.clear();
    this.excludedInternal.clear();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const project = test.parent.project()?.name ?? 'default';
    const tags = readTags(test);
    const key = `${project}:${test.id}`;

    if (!shouldIncludeInBusinessReport(tags, test.location.file)) {
      this.excludedInternal.add(key);
      return;
    }

    const error = sanitizeError(result.error?.message?.split('\n').slice(0, 6).join(' '));
    const existing = this.attempts.get(key) ?? {
      testId: test.id,
      title: test.titlePath().join(' › '),
      project,
      tags,
      sourceFile: test.location.file,
      attempts: [],
      lastSteps: [],
      lastStepDetails: [],
      lastAttachments: [],
      annotations: readAnnotations(test, result)
    };

    existing.attempts.push({
      retry: result.retry,
      status: result.status,
      durationMs: result.duration,
      error,
      failureCategory: result.status === 'failed' || result.status === 'timedOut' ? classifyFailure(error) : undefined
    });
    existing.lastSteps = flattenBusinessSteps(result.steps);
    existing.lastStepDetails = result.steps.filter(step => step.category === 'test.step').map(toStepDetail);
    existing.lastAttachments = result.attachments
      .filter(item => Boolean(item.path))
      .map(item => ({ name: item.name, contentType: item.contentType, sourcePath: item.path }));
    existing.lastError = error;
    existing.annotations = readAnnotations(test, result);
    this.attempts.set(key, existing);
  }

  async onEnd(_result: FullResult): Promise<void> {
    fs.mkdirSync(this.outputDir, { recursive: true });
    const runId = RunContext.get().runId;
    const results = [...this.attempts.values()].map(toFinalBusinessResult);
    const healing = buildHealingSummary(readHealingRecords(runId));
    const aiUsage = buildAiUsageSummary(readAiRecords(runId));
    const internalTestsIncluded = process.env.BUSINESS_REPORT_INCLUDE_INTERNAL === 'true';

    if (!results.length && this.excludedInternal.size > 0 && !internalTestsIncluded) {
      const diagnosticsDir = path.resolve('reports', process.env.APP ?? 'demo', 'framework-validation');
      fs.mkdirSync(diagnosticsDir, { recursive: true });
      fs.writeFileSync(path.join(diagnosticsDir, 'last-run.json'), JSON.stringify({
        runId,
        generatedAt: new Date().toISOString(),
        excludedInternalTests: this.excludedInternal.size,
        message: 'Framework/internal validation run excluded from stakeholder business reporting.'
      }, null, 2));
      return;
    }

    const facts = buildExecutionFacts({
      runId,
      environment: process.env.ENV ?? 'qa',
      application: process.env.APP ?? 'demo',
      results,
      healing,
      aiUsage,
      scope: { excludedInternalTests: this.excludedInternal.size, internalTestsIncluded }
    });

    const historyStore = new ReportHistoryStore();
    const history = process.env.CI ? historyStore.read() : historyStore.append(facts);
    writeBusinessDashboard(this.outputDir, facts, { history, reportUrl: process.env.REPORT_PUBLIC_URL });
  }

  printsToStdio(): boolean { return false; }
}

function toStepDetail(step: TestStep): BusinessStepDetail {
  const status: BusinessStepDetail['status'] = step.error ? 'failed' : 'passed';
  const includeParams = process.env.BUSINESS_REPORT_INCLUDE_STEP_PARAMS === 'true';
  const maybeParams = (step as TestStep & { params?: Record<string, unknown> }).params;
  return {
    title: step.title,
    category: step.category,
    durationMs: step.duration,
    status,
    error: sanitizeError(step.error?.message),
    location: step.location ? { file: step.location.file, line: step.location.line, column: step.location.column } : undefined,
    params: includeParams && maybeParams ? redactObject(maybeParams) : undefined,
    children: step.steps.filter(child => child.category === 'test.step').map(toStepDetail)
  };
}

function flattenBusinessSteps(steps: TestStep[], prefix = ''): string[] {
  const output: string[] = [];
  for (const step of steps) {
    if (step.category !== 'test.step') continue;
    const name = prefix ? `${prefix} > ${step.title}` : step.title;
    output.push(name);
    output.push(...flattenBusinessSteps(step.steps, name));
  }
  return output;
}

function readHealingRecords(runId: string): HealingAuditRecord[] {
  const auditFile = path.resolve('reports', process.env.APP ?? 'demo', 'healing', 'healing-audit.jsonl');
  if (!fs.existsSync(auditFile)) return [];
  const records: HealingAuditRecord[] = [];
  for (const line of fs.readFileSync(auditFile, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line) as HealingAuditRecord;
      if (record.runId === runId) records.push(record);
    } catch { /* malformed historical evidence must not break report */ }
  }
  return records;
}

function readAiRecords(runId: string): AiRuntimeAuditRecord[] {
  const auditFile = path.resolve('reports', process.env.APP ?? 'demo', 'ai', 'ai-audit.jsonl');
  if (!fs.existsSync(auditFile)) return [];
  const records: AiRuntimeAuditRecord[] = [];
  for (const line of fs.readFileSync(auditFile, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line) as AiRuntimeAuditRecord;
      if (record.runId === runId) records.push(record);
    } catch { /* malformed historical evidence must not break report */ }
  }
  return records;
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

function buildHealingSummary(records: HealingAuditRecord[]): HealingSummary {
  return {
    count: records.length,
    fallback: records.filter(record => record.decision.source === 'fallback').length,
    cache: records.filter(record => record.decision.source === 'cache').length,
    ai: records.filter(record => record.decision.source === 'ai').length,
    affectedTests: new Set(records.map(record => record.testId).filter(Boolean)).size,
    records
  };
}

function toBusinessStatus(status: string): 'passed' | 'failed' | 'skipped' {
  if (status === 'passed') return 'passed';
  if (status === 'skipped') return 'skipped';
  return 'failed';
}

function toFinalBusinessResult(item: MutableBusinessTest): BusinessTestResult {
  const attempts = [...item.attempts].sort((a, b) => a.retry - b.retry);
  const finalAttempt = attempts.at(-1) ?? { retry: 0, status: 'skipped', durationMs: 0 };
  const finalStatus = toBusinessStatus(finalAttempt.status);
  const previousFailure = [...attempts].reverse().find(attempt => attempt.failureCategory);
  const flaky = finalStatus === 'passed' && attempts.slice(0, -1).some(attempt => attempt.status !== 'passed' && attempt.status !== 'skipped');
  const classification = classifyTestLayers(item.tags, item.sourceFile);
  const skipAnnotation = finalStatus === 'skipped'
    ? item.annotations.find(annotation => annotation.type === 'skip' || annotation.type === 'fixme')
    : undefined;
  const skipReason = finalStatus === 'skipped' ? sanitizeError(skipAnnotation?.description) : undefined;
  const skipClassification = finalStatus === 'skipped'
    ? classifySkipReason(skipReason, {
        annotationType: skipAnnotation?.type,
        tags: item.tags,
        sourceFile: item.sourceFile,
        title: item.title
      })
    : undefined;
  return {
    testId: item.testId,
    title: item.title,
    project: item.project,
    status: finalStatus,
    rawStatus: finalAttempt.status,
    durationMs: finalAttempt.durationMs,
    totalDurationMs: attempts.reduce((sum, attempt) => sum + attempt.durationMs, 0),
    retriesUsed: Math.max(0, attempts.length - 1),
    flaky,
    tags: item.tags,
    steps: item.lastSteps,
    stepDetails: item.lastStepDetails,
    attachments: item.lastAttachments,
    error: finalStatus === 'failed' ? finalAttempt.error ?? item.lastError : undefined,
    failureCategory: finalStatus === 'failed' ? finalAttempt.failureCategory ?? previousFailure?.failureCategory : undefined,
    skipReason,
    skipCategory: skipClassification?.category,
    attempts,
    sourceFile: item.sourceFile,
    layers: classification.layers,
    testType: classification.testType
  };
}

function readAnnotations(test: TestCase, result: TestResult): Array<{ type: string; description?: string }> {
  const runtime = result.annotations ?? [];
  const declared = test.annotations ?? [];
  const annotations = runtime.length ? runtime : declared;
  return annotations
    .filter(annotation => typeof annotation.type === 'string')
    .map(annotation => ({
      type: String(annotation.type),
      description: sanitizeError(annotation.description)
    }));
}

function readTags(test: TestCase): string[] {
  const maybeTags = (test as TestCase & { tags?: string[] }).tags;
  const fromTitle = test.title.match(/@[\w:-]+/g) ?? [];
  return [...new Set([...(Array.isArray(maybeTags) ? maybeTags : []), ...fromTitle])];
}

function sanitizeError(value?: string): string | undefined {
  return value
    ?.replace(/(authorization|token|password|api[-_]?key)\s*[:=]\s*[^,;\s]+/gi, '$1=[REDACTED]')
    .replace(/bearer\s+[a-z0-9._-]+/gi, 'Bearer [REDACTED]');
}

function redactObject(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = /(authorization|token|password|api[-_]?key|secret)/i.test(key) ? '[REDACTED]' : item;
  }
  return out;
}
