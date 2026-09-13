import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { ComparativeBenchmarkSample, FalseHealBenchmarkEvidence, ScaleExecutionEvidence } from './benchmark.types.js';

/** Immutable benchmark evidence store. Raw evidence remains inspectable; derived summaries can always be regenerated. */
export class BenchmarkEvidenceStore {
  readonly root: string;
  private readonly comparativeDir: string;
  private readonly scaleDir: string;
  private readonly falseHealDir: string;

  constructor(root: string) {
    this.root = path.resolve(root);
    this.comparativeDir = path.join(this.root, 'comparative');
    this.scaleDir = path.join(this.root, 'scale');
    this.falseHealDir = path.join(this.root, 'false-heal');
  }

  static forWorkspace(workspaceRoot: string): BenchmarkEvidenceStore {
    return new BenchmarkEvidenceStore(path.join(workspaceRoot, '.report-history', 'benchmark-intelligence'));
  }

  appendComparative(sample: ComparativeBenchmarkSample): string {
    validateComparative(sample);
    return this.writeImmutable(this.comparativeDir, sample.id, sample);
  }

  appendScale(evidence: ScaleExecutionEvidence): string {
    validateScale(evidence);
    return this.writeImmutable(this.scaleDir, evidence.id, evidence);
  }

  appendFalseHeal(evidence: FalseHealBenchmarkEvidence): string {
    validateFalseHeal(evidence);
    return this.writeImmutable(this.falseHealDir, evidence.id, evidence);
  }

  comparative(): ComparativeBenchmarkSample[] { return this.readDir<ComparativeBenchmarkSample>(this.comparativeDir, validateComparative); }
  scale(): ScaleExecutionEvidence[] { return this.readDir<ScaleExecutionEvidence>(this.scaleDir, validateScale); }
  falseHeal(): FalseHealBenchmarkEvidence[] { return this.readDir<FalseHealBenchmarkEvidence>(this.falseHealDir, validateFalseHeal); }

  private writeImmutable(directory: string, id: string, value: unknown): string {
    fs.mkdirSync(directory, { recursive: true });
    const target = path.join(directory, `${safe(id)}.json`);
    const serialized = `${JSON.stringify(value, null, 2)}\n`;
    try {
      const fd = fs.openSync(target, 'wx', 0o600);
      try { fs.writeFileSync(fd, serialized, 'utf8'); } finally { fs.closeSync(fd); }
      return target;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const existing = fs.readFileSync(target, 'utf8');
      if (sha(existing) !== sha(serialized)) throw new Error(`BENCHMARK_EVIDENCE_CONFLICT: '${id}' already exists with different content.`);
      return target;
    }
  }

  private readDir<T>(directory: string, validate: (value: T) => void): T[] {
    if (!fs.existsSync(directory)) return [];
    const values: T[] = [];
    for (const file of fs.readdirSync(directory).filter((name: string) => name.endsWith('.json')).sort()) {
      try { const value = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8')) as T; validate(value); values.push(value); } catch { /* invalid benchmark evidence is never trusted */ }
    }
    return values;
  }
}

function validateComparative(value: ComparativeBenchmarkSample): void {
  if (!value || value.schemaVersion !== 1 || !value.id || !value.application || !value.datasetVersion || !value.metric || !value.baselineLabel || !value.evidenceRef || !value.productVersion || !value.commit || !value.runtime || !value.platform || !value.environmentDescription || !value.methodology || !value.evidenceSha256) throw new Error('Invalid comparative benchmark evidence.');
  safe(value.id); safe(value.application); safe(value.datasetVersion);
  if (!Number.isFinite(value.baselineValue) || value.baselineValue < 0 || !Number.isFinite(value.testigentValue) || value.testigentValue < 0) throw new Error('Benchmark values must be finite and non-negative.');
  const expectedUnit = value.metric.endsWith('-minutes') ? 'minutes' : value.metric.endsWith('-percent') ? 'percent' : value.metric.endsWith('-usd') ? 'usd' : undefined;
  if (!expectedUnit || value.unit !== expectedUnit) throw new Error(`Benchmark metric '${value.metric}' requires unit '${expectedUnit ?? 'unknown'}'.`);
  if (value.unit === 'percent' && (value.baselineValue > 100 || value.testigentValue > 100)) throw new Error('Percent benchmark values must be between 0 and 100.');
  if (!/^[0-9a-f]{64}$/i.test(value.evidenceSha256)) throw new Error('Benchmark evidenceSha256 must be a 64-character SHA-256 digest.');
}

function validateFalseHeal(value: FalseHealBenchmarkEvidence): void {
  if (!value || value.schemaVersion !== 1 || !value.id || !value.application || !value.environment || !value.datasetVersion || !value.evidenceRef || !value.productVersion || !value.commit || !value.runtime || !value.platform || !value.environmentDescription || !value.methodology || !value.evidenceSha256) throw new Error('Invalid false-heal benchmark evidence.');
  safe(value.id); safe(value.application); safe(value.environment); safe(value.datasetVersion);
  if (!Array.isArray(value.scenarios) || value.scenarios.length < 1) throw new Error('False-heal benchmark evidence requires at least one scenario.');
  const seen = new Set<string>();
  for (const scenario of value.scenarios) {
    if (!scenario?.id || !scenario.injectedFault || !['PASS', 'FAIL'].includes(scenario.expectedBusinessOutcome) || !['CLEAN_PASS', 'FAILED', 'HEALED_PASS', 'RETRY_PASS'].includes(scenario.observedAutomationOutcome)) throw new Error('Invalid false-heal benchmark scenario.');
    safe(scenario.id);
    if (seen.has(scenario.id)) throw new Error(`Duplicate false-heal scenario id '${scenario.id}'.`);
    seen.add(scenario.id);
  }
  if (!/^[0-9a-f]{64}$/i.test(value.evidenceSha256)) throw new Error('False-heal evidenceSha256 must be a 64-character SHA-256 digest.');
}

function validateScale(value: ScaleExecutionEvidence): void {
  if (!value || value.schemaVersion !== 1 || !value.id || !value.application || !value.environment || !value.datasetVersion || !value.selection || !value.evidenceRef || !value.productVersion || !value.commit || !value.runtime || !value.platform || !value.environmentDescription || !value.methodology || !value.evidenceSha256) throw new Error('Invalid scale benchmark evidence.');
  safe(value.id); safe(value.application); safe(value.environment); safe(value.datasetVersion);
  for (const [label, count] of Object.entries({ caseCount: value.caseCount, executedCases: value.executedCases, duplicateCases: value.duplicateCases, droppedCases: value.droppedCases, workers: value.workers, shards: value.shards })) {
    if (!Number.isInteger(count) || count < 0) throw new Error(`Scale ${label} must be a non-negative integer.`);
  }
  if (value.caseCount < 1 || value.workers < 1 || value.shards < 1) throw new Error('Scale caseCount/workers/shards must be positive integers.');
  if (!Number.isFinite(value.wallClockMs) || value.wallClockMs <= 0) throw new Error('Scale wallClockMs must be a positive finite duration.');
  if (!Array.isArray(value.shardDurationsMs) || value.shardDurationsMs.length !== value.shards || value.shardDurationsMs.some(item => !Number.isFinite(item) || item < 0) || !value.shardDurationsMs.some(item => item > 0)) throw new Error('Scale shardDurationsMs must contain one finite non-negative duration per shard and at least one measured duration.');
  if (!/^[0-9a-f]{64}$/i.test(value.evidenceSha256)) throw new Error('Scale evidenceSha256 must be a 64-character SHA-256 digest.');
}

function safe(value: string): string { const normalized = value.trim(); if (!normalized || normalized === '.' || normalized === '..' || !/^[A-Za-z0-9._-]+$/.test(normalized)) throw new Error(`Unsafe benchmark path segment '${value}'.`); return normalized; }
function sha(value: string): string { return createHash('sha256').update(value).digest('hex'); }
