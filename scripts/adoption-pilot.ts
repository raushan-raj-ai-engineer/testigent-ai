import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { WorkspaceContext } from '../src/framework/core/config/workspace.context';
import { RunContext } from '../src/framework/core/config/run.context';
import { ProjectPaths } from '../src/framework/core/config/project.paths';
import { AdoptionObservationStore, expectedUnit } from '../src/framework/adoption/adoption-store';
import { analyzeAdoption } from '../src/framework/adoption/adoption-analyzer';
import { ADOPTION_METRICS, type AdoptionMetric, type AdoptionObservation } from '../src/framework/adoption/adoption.types';
import { renderAdoptionIntelligenceHtml } from '../src/framework/reporting/adoption-intelligence.renderer';

const command = (process.argv[2] ?? 'report').toLowerCase();
const args = process.argv.slice(3);
const target = WorkspaceContext.resolve();
const store = AdoptionObservationStore.forScope(process.cwd(), target.application, target.environment);

if (command === 'record') {
  const metric = required('--metric') as AdoptionMetric;
  if (!(ADOPTION_METRICS as readonly string[]).includes(metric)) throw new Error(`Unsupported metric '${metric}'. Allowed: ${ADOPTION_METRICS.join(', ')}`);
  const value = numeric(required('--value'), '--value');
  const baselineRaw = optional('--baseline');
  const observation = store.append({
    application: target.application,
    environment: target.environment,
    metric,
    value,
    unit: expectedUnit(metric),
    source: 'measured',
    contributorKey: optional('--contributor'),
    baselineValue: baselineRaw === undefined ? undefined : numeric(baselineRaw, '--baseline'),
    evidenceRef: optional('--evidence'),
    note: optional('--note'),
    id: optional('--id'),
  });
  console.log(JSON.stringify({ ok: true, observation }, null, 2));
} else if (command === 'import-authoring') {
  const source = path.resolve(optional('--input') ?? path.join('reports', target.application, target.environment, 'productivity', 'authoring-productivity.json'));
  if (!fs.existsSync(source)) throw new Error(`Authoring productivity file not found: ${source}`);
  const parsed = JSON.parse(fs.readFileSync(source, 'utf8')) as { events?: Array<{ requirementId: string; mode: string; completedAt: string; elapsedMinutes: number; manualBaselineMinutes?: number }> };
  const events = parsed.events ?? [];
  const contributor = optional('--contributor');
  const records: AdoptionObservation[] = [];
  for (const event of events) {
    records.push(store.append({
      id: `authoring-${safe(event.requirementId)}-${safe(event.completedAt)}`,
      recordedAt: event.completedAt,
      application: target.application,
      environment: target.environment,
      metric: 'authoring-session-minutes',
      value: event.elapsedMinutes,
      unit: 'minutes',
      source: 'imported',
      contributorKey: contributor,
      baselineValue: event.manualBaselineMinutes,
      evidenceRef: path.relative(process.cwd(), source).replace(/\\/g, '/'),
      note: `Imported measured authoring session (${event.mode}).`,
    }));
  }
  writeReport();
  console.log(JSON.stringify({ ok: true, imported: records.length, source: path.relative(process.cwd(), source) }, null, 2));
} else if (command === 'report') {
  writeReport();
} else if (command === 'list-metrics') {
  console.log(ADOPTION_METRICS.join('\n'));
} else {
  throw new Error('Usage: adoption-pilot.ts record|import-authoring|report|list-metrics');
}

function writeReport(): void {
  const summary = analyzeAdoption(AdoptionObservationStore.readWorkspace(process.cwd(), target.environment));
  const run = RunContext.persistCurrent();
  const outputDir = path.join(ProjectPaths.reports(target.application, target.environment, run.runId), 'adoption');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'adoption-summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(outputDir, 'adoption-intelligence.html'), renderAdoptionIntelligenceHtml(summary));
  fs.writeFileSync(path.join(outputDir, 'adoption-summary.md'), markdown(summary));
  console.log(JSON.stringify({ ok: true, status: summary.pilotStatus, observations: summary.observations, applications: summary.applications.length, contributors: summary.contributors.length, report: path.relative(process.cwd(), path.join(outputDir, 'adoption-intelligence.html')) }, null, 2));
}

function markdown(summary: ReturnType<typeof analyzeAdoption>): string {
  const rows = summary.metrics.length ? summary.metrics.map(item => `| ${item.metric} | ${item.samples} | ${item.median} ${item.unit} | ${item.baselineMedian ?? '—'} | ${item.medianDeltaPercent === null ? '—' : `${item.medianDeltaPercent}%`} | ${item.claimStatus} |`).join('\n') : '| — | 0 | — | — | — | INSUFFICIENT_EVIDENCE |';
  return `# TestigentAI Adoption Intelligence\n\nStatus: **${summary.pilotStatus}**\n\nApplications: ${summary.applications.join(', ') || 'none'}  \nOpaque contributors: ${summary.contributors.join(', ') || 'none'}\n\n| Metric | Samples | Median | Baseline median | Delta | Claim status |\n| --- | ---: | ---: | ---: | ---: | --- |\n${rows}\n\n## Truth boundary\n\n${summary.truthBoundary}\n`;
}
function optional(name: string): string | undefined { const exact = args.find((arg: string) => arg.startsWith(`${name}=`)); if (exact) return exact.slice(name.length + 1); const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; }
function required(name: string): string { const value = optional(name); if (!value) throw new Error(`Missing ${name}.`); return value; }
function numeric(value: string, name: string): number { const number = Number(value); if (!Number.isFinite(number) || number < 0) throw new Error(`${name} must be a finite non-negative number.`); return number; }
function safe(value: string): string { return value.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 80); }
