import fs from 'node:fs';
import path from 'node:path';
import type { BusinessAttachment, ExecutionFacts } from '../analytics/report.types';
import { renderBusinessHtml, type BusinessDashboardOptions } from './business-html.renderer';
import { buildEvidenceGraph, renderEvidenceLedgerHtml } from '../analytics/evidence-graph';
import { renderAiProviderHealthHtml } from './ai-provider-health.renderer';
import { AgentDecisionLedger } from '../agentic/evidence/agent-decision-ledger';
import { renderAgenticIntelligenceHtml } from './agentic-intelligence.renderer';
import { AdoptionObservationStore } from '../adoption/adoption-store.js';
import { analyzeAdoption } from '../adoption/adoption-analyzer.js';
import { renderAdoptionIntelligenceHtml } from './adoption-intelligence.renderer.js';
import { BenchmarkEvidenceStore } from '../benchmark/benchmark-store.js';
import { analyzeBenchmarks } from '../benchmark/benchmark-analyzer.js';
import { renderBenchmarkIntelligenceHtml } from './benchmark-intelligence.renderer.js';
import { renderApiContractIntelligenceHtml, type ApiContractIntelligenceSummary } from './api-contract-intelligence.renderer.js';
import { renderFailureIntelligenceHtml } from './failure-intelligence.renderer.js';
import { renderCustomerShowcaseHtml } from './customer-showcase.renderer.js';
import { failureSignalsFromExecutionFacts } from '../failure-intelligence/report-adapter.js';
import { analyzeFailureIntelligence } from '../failure-intelligence/failure-analyzer.js';
import { validateShowcaseDataset, type ShowcaseDataset } from '../failure-intelligence/showcase-policy.js';
import { FailureHistoryStore } from '../failure-intelligence/failure-history.store.js';

/**
 * Author: Raushan Raj
 * Business Use: Writes the complete business dashboard bundle (HTML, client JS, CSV, evidence and JSON) from one deterministic facts object.
 * How to use: Reporter and dashboard regeneration scripts call this writer instead of writing index.html directly.
 * Benefit: Local, CI, merged and emailed reports use the same bundle contract and cannot drift into different dashboard behaviors.
 */
export function writeBusinessDashboard(outputDir: string, input: ExecutionFacts, options: BusinessDashboardOptions = {}): ExecutionFacts {
  fs.mkdirSync(outputDir, { recursive: true });
  const facts = cloneFacts(input);
  materializeEvidence(outputDir, facts);
  const assetsDir = path.join(outputDir, 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  const clientSource = path.join(__dirname, 'assets', 'dashboard.js');
  if (!fs.existsSync(clientSource)) throw new Error(`Dashboard client asset not found: ${clientSource}`);
  fs.copyFileSync(clientSource, path.join(assetsDir, 'dashboard.js'));
  fs.writeFileSync(path.join(outputDir, 'business-tests.csv'), toCsv(facts), 'utf8');
  fs.writeFileSync(path.join(outputDir, 'business-report.json'), JSON.stringify(facts, null, 2), 'utf8');
  const evidenceGraph = buildEvidenceGraph(facts);
  fs.writeFileSync(path.join(outputDir, 'evidence-graph.json'), JSON.stringify(evidenceGraph, null, 2), 'utf8');
  fs.writeFileSync(path.join(outputDir, 'evidence-ledger.html'), renderEvidenceLedgerHtml(evidenceGraph, facts), 'utf8');
  fs.writeFileSync(path.join(outputDir, 'ai-provider-health.html'), renderAiProviderHealthHtml(options.providerHealth ?? { status: 'SKIPPED', samples: 0, healthySamples: 0, degradedSamples: 0, availabilityPercent: null, averageGenerationLatencyMs: null, recent: [] }), 'utf8');
  const agenticLedger = new AgentDecisionLedger(path.join(path.dirname(outputDir), 'agentic'));
  const agenticSummary = options.agenticSummary ?? agenticLedger.summary();
  fs.writeFileSync(path.join(outputDir, 'agentic-intelligence.html'), renderAgenticIntelligenceHtml(agenticSummary, agenticLedger.read()), 'utf8');
  const adoptionSummary = analyzeAdoption(AdoptionObservationStore.readWorkspace(process.cwd(), facts.environment));
  fs.writeFileSync(path.join(outputDir, 'adoption-intelligence.html'), renderAdoptionIntelligenceHtml(adoptionSummary), 'utf8');
  const benchmarkStore = BenchmarkEvidenceStore.forWorkspace(process.cwd());
  const benchmarkSummary = analyzeBenchmarks(benchmarkStore.comparative(), benchmarkStore.scale(), benchmarkStore.falseHeal());
  fs.writeFileSync(path.join(outputDir, 'benchmark-intelligence.html'), renderBenchmarkIntelligenceHtml(benchmarkSummary), 'utf8');
  fs.writeFileSync(path.join(outputDir, 'api-contract-intelligence.html'), renderApiContractIntelligenceHtml(readApiContractSummary(outputDir)), 'utf8');
  const failureSignals = failureSignalsFromExecutionFacts(facts);
  const failureSummary = analyzeFailureIntelligence(failureSignals);
  persistLiveFailureOccurrences(facts, failureSignals, failureSummary);
  fs.writeFileSync(path.join(outputDir, 'failure-intelligence.html'), renderFailureIntelligenceHtml(failureSummary), 'utf8');
  writeCustomerShowcase(outputDir);
  fs.writeFileSync(path.join(outputDir, 'index.html'), renderBusinessHtml(facts, { ...options, agenticSummary }), 'utf8');
  return facts;
}

function materializeEvidence(outputDir: string, facts: ExecutionFacts): void {
  const includeVideo = process.env.BUSINESS_REPORT_INCLUDE_VIDEO === 'true';
  const evidenceRoot = path.join(outputDir, 'evidence');
  for (const result of facts.results) {
    for (const attachment of result.attachments ?? []) {
      if (!attachment.sourcePath || !fs.existsSync(attachment.sourcePath) || !shouldCopy(attachment, includeVideo, result.status === 'failed')) continue;
      const testDir = path.join(evidenceRoot, safeFile(`${result.project}-${result.testId}`));
      fs.mkdirSync(testDir, { recursive: true });
      const ext = path.extname(attachment.sourcePath);
      const targetName = safeFile(`${attachment.name}${ext && !attachment.name.endsWith(ext) ? ext : ''}`);
      const targetPath = uniquePath(path.join(testDir, targetName));
      fs.copyFileSync(attachment.sourcePath, targetPath);
      attachment.reportPath = path.relative(outputDir, targetPath).split(path.sep).join('/');
    }
  }
}

function shouldCopy(attachment: BusinessAttachment, includeVideo: boolean, failedScenario: boolean): boolean {
  if (attachment.contentType.startsWith('image/')) return true;
  if (attachment.contentType.includes('zip')) return true;
  if (attachment.contentType.includes('json') || attachment.contentType.startsWith('text/')) return true;
  if ((includeVideo || failedScenario) && attachment.contentType.startsWith('video/')) return true;
  return false;
}

function uniquePath(candidate: string): string {
  if (!fs.existsSync(candidate)) return candidate;
  const ext = path.extname(candidate);
  const base = candidate.slice(0, candidate.length - ext.length);
  let index = 2;
  while (fs.existsSync(`${base}-${index}${ext}`)) index += 1;
  return `${base}-${index}${ext}`;
}

function toCsv(facts: ExecutionFacts): string {
  const rows: string[][] = [['Scenario', 'Business Outcome', 'Raw Status', 'Quality Status', 'CI Blocking', 'Known Defect ID', 'Known Defect Title', 'Test Type', 'Layers', 'Project', 'Tags', 'Duration ms', 'Retries', 'Flaky', 'Self Healed', 'Failure Category', 'Skip Category', 'Skip Reason', 'Source File']];
  const healed = new Set(facts.healing.records.map(record => record.testId).filter(Boolean));
  for (const result of facts.results) rows.push([
    result.title,
    result.outcome ?? result.status.toUpperCase(),
    result.rawStatus,
    result.qualityStatus ?? '',
    String(Boolean(result.ciBlocking)),
    result.knownDefect?.id ?? '',
    result.knownDefect?.title ?? '',
    result.testType ?? 'OTHER',
    (result.layers ?? []).join('+'),
    result.project,
    result.tags.join(' '),
    String(result.totalDurationMs),
    String(result.retriesUsed),
    String(result.flaky),
    String(healed.has(result.testId)),
    result.failureCategory ?? '',
    result.skipCategory ?? '',
    result.skipReason ?? '',
    result.sourceFile ?? ''
  ]);
  return rows.map(row => row.map(csvCell).join(',')).join('\n') + '\n';
}

function csvCell(value: unknown): string { return spreadsheetSafeCsvCell(value); }

/** Spreadsheet-safe CSV cell. JSON retains exact source values; human CSV neutralizes formula prefixes. */
export function spreadsheetSafeCsvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[\t\r]/.test(text) || /^\s*[=+\-@]/.test(text)) text = `\'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
function safeFile(value: string): string { return value.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 140); }
function cloneFacts(value: ExecutionFacts): ExecutionFacts { return JSON.parse(JSON.stringify(value)) as ExecutionFacts; }


function persistLiveFailureOccurrences(facts: ExecutionFacts, signals: ReturnType<typeof failureSignalsFromExecutionFacts>, summary: ReturnType<typeof analyzeFailureIntelligence>): void {
  const store = FailureHistoryStore.forScope(process.cwd(), facts.application, facts.environment);
  for (const classification of summary.classifications) {
    if (!classification.claimEligible || classification.evidenceMode !== 'LIVE' || classification.synthetic) continue;
    const signal = signals.find(item => item.scenarioId === classification.scenarioId);
    store.append(classification, { runId: facts.runId, attempt: signal?.retriesUsed ?? 0, environment: facts.environment, project: signal?.project });
  }
}

function readApiContractSummary(outputDir: string): ApiContractIntelligenceSummary {
  const source = path.join(path.dirname(outputDir), 'api-contract', 'api-contract-summary.json');
  if (!fs.existsSync(source)) return { status: 'NO_EVIDENCE', generatedAt: new Date().toISOString(), breakingChanges: [], responseValidations: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(source, 'utf8')) as ApiContractIntelligenceSummary;
    if (!parsed || !['NO_EVIDENCE', 'PASS', 'BREAKING_CHANGES', 'VALIDATION_FAILURES'].includes(parsed.status)) throw new Error('unsupported status');
    return parsed;
  } catch {
    return { status: 'VALIDATION_FAILURES', generatedAt: new Date().toISOString(), breakingChanges: [], responseValidations: [] };
  }
}

function writeCustomerShowcase(outputDir: string): void {
  const source = path.join(process.cwd(), 'showcase', 'customer-demo.json');
  if (!fs.existsSync(source)) return;
  try {
    const dataset = JSON.parse(fs.readFileSync(source, 'utf8')) as ShowcaseDataset;
    validateShowcaseDataset(dataset);
    const summary = analyzeFailureIntelligence(dataset.scenarios);
    if (summary.claimEligible) throw new Error('showcase unexpectedly became claim eligible');
    fs.writeFileSync(path.join(outputDir, 'showcase.html'), renderCustomerShowcaseHtml(dataset, summary), 'utf8');
    fs.writeFileSync(path.join(outputDir, 'showcase-failure-intelligence.html'), renderFailureIntelligenceHtml(summary, { showcase: true, backHref: './showcase.html' }), 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fs.writeFileSync(path.join(outputDir, 'showcase.html'), `<!doctype html><html><body><h1>Showcase unavailable</h1><p>${escapeInlineHtml(message)}</p></body></html>`, 'utf8');
  }
}

function escapeInlineHtml(value: string): string { return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char)); }
