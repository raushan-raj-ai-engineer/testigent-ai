import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { BenchmarkEvidenceStore } from '../src/framework/benchmark/benchmark-store';
import { evaluateFalseHealSafety } from '../src/framework/benchmark/false-heal-benchmark';
import { analyzeBenchmarks } from '../src/framework/benchmark/benchmark-analyzer';
import type { FalseHealBenchmarkEvidence } from '../src/framework/benchmark/benchmark.types';
import { renderBenchmarkIntelligenceHtml } from '../src/framework/reporting/benchmark-intelligence.renderer';

const args = process.argv.slice(2);
const input = path.resolve(required('--input'));
if (!fs.existsSync(input)) throw new Error(`False-heal input not found: ${input}`);
const sourceBytes = fs.readFileSync(input);
const raw = JSON.parse(sourceBytes.toString('utf8')) as Partial<FalseHealBenchmarkEvidence> & { templateOnly?: boolean };
if (raw.templateOnly) throw new Error('False-heal template files are examples only; copy the template and replace all placeholder values before import.');
const packageVersion = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')) as { version: string };
const evidence: FalseHealBenchmarkEvidence = {
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
  id: requiredField(raw.id, 'id'),
  application: requiredField(raw.application, 'application'),
  environment: requiredField(raw.environment, 'environment'),
  datasetVersion: requiredField(raw.datasetVersion, 'datasetVersion'),
  scenarios: raw.scenarios ?? [],
};
if (!evidence.environmentDescription.trim() || !evidence.methodology.trim()) throw new Error('False-heal evidence requires environmentDescription and methodology (input fields or CLI options).');
const result = evaluateFalseHealSafety(evidence.scenarios);
const store = BenchmarkEvidenceStore.forWorkspace(process.cwd());
store.appendFalseHeal(evidence);
const outputDir = path.resolve('reports', 'benchmark-intelligence');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, `false-heal-${safe(evidence.id)}.json`), JSON.stringify({ evidence, result }, null, 2));
fs.writeFileSync(path.join(outputDir, 'benchmark-intelligence.html'), renderBenchmarkIntelligenceHtml(analyzeBenchmarks(store.comparative(), store.scale(), store.falseHeal())));
console.log(JSON.stringify({ ok: result.status !== 'FAIL', result, evidenceSha256: evidence.evidenceSha256, report: path.relative(process.cwd(), path.join(outputDir, 'benchmark-intelligence.html')) }, null, 2));
if (result.status === 'FAIL') process.exitCode = 1;

function optional(name: string): string | undefined { const exact = args.find((arg: string) => arg.startsWith(`${name}=`)); if (exact) return exact.slice(name.length + 1); const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; }
function required(name: string): string { const value = optional(name); if (!value) throw new Error(`Missing ${name}.`); return value; }
function requiredField<T>(value: T | undefined, label: string): T { if (value === undefined || value === null || String(value).trim() === '') throw new Error(`Missing ${label}.`); return value; }
function safe(value: string): string { const normalized = value.trim(); if (!normalized || normalized === '.' || normalized === '..' || !/^[A-Za-z0-9._-]+$/.test(normalized)) throw new Error(`Unsafe evidence id '${value}'.`); return normalized; }
function resolveCommit(): string { const fromEnv = process.env.GITHUB_SHA ?? process.env.BUILD_SOURCEVERSION ?? process.env.CI_COMMIT_SHA; if (fromEnv) return fromEnv; try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return 'unavailable'; } }
