import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { BenchmarkEvidenceStore } from '../src/framework/benchmark/benchmark-store';
import { buildSyntheticScalePlan, evaluateScaleEvidence } from '../src/framework/benchmark/scale-certification';
import type { ScaleExecutionEvidence } from '../src/framework/benchmark/benchmark.types';
import { analyzeBenchmarks } from '../src/framework/benchmark/benchmark-analyzer';
import { renderBenchmarkIntelligenceHtml } from '../src/framework/reporting/benchmark-intelligence.renderer';

const command = (process.argv[2] ?? 'plan').toLowerCase();
const args = process.argv.slice(3);
const store = BenchmarkEvidenceStore.forWorkspace(process.cwd());

if (command === 'plan') {
  const cases = positiveInteger(optional('--cases') ?? '500', '--cases');
  const shards = positiveInteger(optional('--shards') ?? String(Math.min(8, Math.max(1, Math.ceil(cases / 250)))), '--shards');
  const started = performance.now();
  const plan = buildSyntheticScalePlan(cases, shards);
  const plannerWallClockMs = Math.round((performance.now() - started) * 1000) / 1000;
  const estimates = plan.map(item => item.estimatedMs);
  console.log(JSON.stringify({ ok: true, kind: 'synthetic-planning-diagnostic', cases, shards, plannerWallClockMs, estimatedShardDurationsMs: estimates, truthBoundary: 'This command exercises deterministic planning only. It is not browser/SUT scale certification. Use evaluate with measured execution evidence.' }, null, 2));
} else if (command === 'evaluate') {
  const input = path.resolve(required('--input'));
  const sourceBytes = fs.readFileSync(input);
  const raw = JSON.parse(sourceBytes.toString('utf8')) as Partial<ScaleExecutionEvidence> & { templateOnly?: boolean };
  if (raw.templateOnly) throw new Error('Scale template files are examples only; copy the template and replace all placeholder values before evaluation.');
  const packageVersion = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')) as { version: string };
  const evidence: ScaleExecutionEvidence = {
    ...raw,
    schemaVersion: 1,
    productVersion: raw.productVersion ?? packageVersion.version,
    commit: raw.commit ?? resolveCommit(),
    runtime: raw.runtime ?? `node ${process.version}`,
    platform: raw.platform ?? `${process.platform}-${process.arch}`,
    environmentDescription: raw.environmentDescription ?? optional('--environment-description') ?? process.env.BENCHMARK_ENVIRONMENT_DESCRIPTION ?? '',
    methodology: raw.methodology ?? optional('--methodology') ?? '',
    evidenceRef: raw.evidenceRef ?? path.relative(process.cwd(), input).replace(/\\/g, '/'),
    evidenceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
    id: requiredField(raw.id, 'id'), application: requiredField(raw.application, 'application'), environment: requiredField(raw.environment, 'environment'), datasetVersion: requiredField(raw.datasetVersion, 'datasetVersion'), selection: requiredField(raw.selection, 'selection'),
    caseCount: requiredNumber(raw.caseCount, 'caseCount'), executedCases: requiredNumber(raw.executedCases, 'executedCases'), duplicateCases: requiredNumber(raw.duplicateCases, 'duplicateCases'), droppedCases: requiredNumber(raw.droppedCases, 'droppedCases'), workers: requiredNumber(raw.workers, 'workers'), shards: requiredNumber(raw.shards, 'shards'), wallClockMs: requiredNumber(raw.wallClockMs, 'wallClockMs'), shardDurationsMs: raw.shardDurationsMs ?? [],
  };
  if (!evidence.environmentDescription.trim() || !evidence.methodology.trim()) throw new Error('Scale evidence requires environmentDescription and methodology (input fields or CLI options).');
  const result = evaluateScaleEvidence(evidence);
  store.appendScale(evidence);
  const outputDir = path.resolve('reports', 'benchmark-intelligence');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, `scale-${safe(evidence.id)}.json`), JSON.stringify({ evidence, result }, null, 2));
  fs.writeFileSync(path.join(outputDir, 'benchmark-intelligence.html'), renderBenchmarkIntelligenceHtml(analyzeBenchmarks(store.comparative(), store.scale(), store.falseHeal())));
  console.log(JSON.stringify({ ok: result.status !== 'FAIL', result, evidenceSha256: evidence.evidenceSha256, report: path.relative(process.cwd(), path.join(outputDir, 'benchmark-intelligence.html')) }, null, 2));
  if (result.status === 'FAIL') process.exitCode = 1;
} else {
  throw new Error('Usage: benchmark-scale.ts plan --cases=500 --shards=4 | evaluate --input=<measured-scale-evidence.json>');
}

function optional(name: string): string | undefined { const exact = args.find((arg: string) => arg.startsWith(`${name}=`)); if (exact) return exact.slice(name.length + 1); const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; }
function required(name: string): string { const value = optional(name); if (!value) throw new Error(`Missing ${name}.`); return value; }
function positiveInteger(value: string, name: string): number { const number = Number(value); if (!Number.isInteger(number) || number < 1) throw new Error(`${name} must be a positive integer.`); return number; }
function requiredField<T>(value: T | undefined, label: string): T { if (value === undefined || value === null || String(value).trim() === '') throw new Error(`Missing ${label}.`); return value; }
function requiredNumber(value: number | undefined, label: string): number { if (!Number.isFinite(value)) throw new Error(`Missing/invalid ${label}.`); return Number(value); }
function safe(value: string): string { return value.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 100); }
function resolveCommit(): string { const fromEnv = process.env.GITHUB_SHA ?? process.env.BUILD_SOURCEVERSION ?? process.env.CI_COMMIT_SHA; if (fromEnv) return fromEnv; try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return 'unavailable'; } }
