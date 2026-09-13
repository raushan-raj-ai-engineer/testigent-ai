import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { BenchmarkEvidenceStore } from '../src/framework/benchmark/benchmark-store';
import { summarizeComparativeBenchmark } from '../src/framework/benchmark/comparative-benchmark';
import type { ComparativeBenchmarkSample } from '../src/framework/benchmark/benchmark.types';
import { renderBenchmarkIntelligenceHtml } from '../src/framework/reporting/benchmark-intelligence.renderer';
import { analyzeBenchmarks } from '../src/framework/benchmark/benchmark-analyzer';

const args = process.argv.slice(2);
const input = path.resolve(required('--input'));
if (!fs.existsSync(input)) throw new Error(`Benchmark input not found: ${input}`);
const sourceBytes = fs.readFileSync(input);
const parsed = JSON.parse(sourceBytes.toString('utf8')) as Array<Partial<ComparativeBenchmarkSample>> | { templateOnly?: boolean; samples?: Array<Partial<ComparativeBenchmarkSample>> };
if (!Array.isArray(parsed) && parsed.templateOnly) throw new Error('Benchmark template files are examples only; copy the template and replace all placeholder values before import.');
const rawSamples = Array.isArray(parsed) ? parsed : parsed.samples ?? [];
if (!rawSamples.length) throw new Error('Benchmark input contains no samples.');
const digest = createHash('sha256').update(sourceBytes).digest('hex');
const packageVersion = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')) as { version: string };
const samples = rawSamples.map((sample, index): ComparativeBenchmarkSample => ({
  ...sample,
  schemaVersion: 1,
  productVersion: sample.productVersion ?? packageVersion.version,
  commit: sample.commit ?? resolveCommit(),
  runtime: sample.runtime ?? `node ${process.version}`,
  platform: sample.platform ?? `${process.platform}-${process.arch}`,
  environmentDescription: sample.environmentDescription ?? optional('--environment-description') ?? process.env.BENCHMARK_ENVIRONMENT_DESCRIPTION ?? '',
  methodology: sample.methodology ?? optional('--methodology') ?? '',
  evidenceSha256: digest,
  id: requiredField(sample.id, `samples[${index}].id`),
  application: requiredField(sample.application, `samples[${index}].application`),
  datasetVersion: requiredField(sample.datasetVersion, `samples[${index}].datasetVersion`),
  metric: requiredField(sample.metric, `samples[${index}].metric`) as ComparativeBenchmarkSample['metric'],
  unit: requiredField(sample.unit, `samples[${index}].unit`) as ComparativeBenchmarkSample['unit'],
  baselineLabel: requiredField(sample.baselineLabel, `samples[${index}].baselineLabel`),
  baselineValue: requiredNumber(sample.baselineValue, `samples[${index}].baselineValue`),
  testigentValue: requiredNumber(sample.testigentValue, `samples[${index}].testigentValue`),
  evidenceRef: sample.evidenceRef ?? path.relative(process.cwd(), input).replace(/\\/g, '/'),
}));
if (samples.some(sample => !sample.environmentDescription.trim() || !sample.methodology.trim())) throw new Error('Benchmark samples require environmentDescription and methodology (input fields or CLI options).');
const store = BenchmarkEvidenceStore.forWorkspace(process.cwd());
for (const sample of samples) store.appendComparative(sample);
const summary = summarizeComparativeBenchmark(store.comparative());
const outputDir = path.resolve('reports', 'benchmark-intelligence');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'comparative-benchmark.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(outputDir, 'benchmark-intelligence.html'), renderBenchmarkIntelligenceHtml(analyzeBenchmarks(store.comparative(), store.scale(), store.falseHeal())));
console.log(JSON.stringify({ ok: true, imported: samples.length, evidenceSha256: digest, differentiationStatus: summary.differentiationStatus, metrics: summary.metrics, report: path.relative(process.cwd(), path.join(outputDir, 'benchmark-intelligence.html')) }, null, 2));

function optional(name: string): string | undefined { const exact = args.find((arg: string) => arg.startsWith(`${name}=`)); if (exact) return exact.slice(name.length + 1); const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; }
function required(name: string): string { const value = optional(name); if (!value) throw new Error(`Missing ${name}.`); return value; }
function requiredField<T>(value: T | undefined, label: string): T { if (value === undefined || value === null || String(value).trim() === '') throw new Error(`Missing ${label}.`); return value; }
function requiredNumber(value: number | undefined, label: string): number { if (!Number.isFinite(value)) throw new Error(`Missing/invalid ${label}.`); return Number(value); }
function resolveCommit(): string { const fromEnv = process.env.GITHUB_SHA ?? process.env.BUILD_SOURCEVERSION ?? process.env.CI_COMMIT_SHA; if (fromEnv) return fromEnv; try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return 'unavailable'; } }
