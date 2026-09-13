import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { summarizeComparativeBenchmark } from '../../src/framework/benchmark/comparative-benchmark.js';
import { BenchmarkEvidenceStore } from '../../src/framework/benchmark/benchmark-store.js';
import { evaluateFalseHealSafety } from '../../src/framework/benchmark/false-heal-benchmark.js';
import { buildSyntheticScalePlan, evaluateScaleEvidence } from '../../src/framework/benchmark/scale-certification.js';
import type { ComparativeBenchmarkSample, FalseHealBenchmarkEvidence, ScaleExecutionEvidence } from '../../src/framework/benchmark/benchmark.types.js';

test.describe('Benchmark intelligence contract', () => {
  test('requires multi-application baseline evidence before differentiating from plain Playwright', () => {
    const samples: ComparativeBenchmarkSample[] = [
      sample('a1', 'app-a', 40, 20), sample('a2', 'app-a', 42, 19), sample('b1', 'app-b', 50, 25), sample('b2', 'app-b', 48, 24),
    ];
    const summary = summarizeComparativeBenchmark(samples);
    expect(summary.differentiationStatus).toBe('EVIDENCE_READY');
    expect(summary.metrics[0]?.result).toBe('IMPROVED');
    expect(summary.metrics[0]?.deltaPercent).toBeLessThan(0);
  });

  test('synthetic baseline data never becomes a market claim', () => {
    const summary = summarizeComparativeBenchmark([
      { ...sample('a1', 'app-a', 40, 20), evidenceRef: 'synthetic:a1' },
      { ...sample('a2', 'app-a', 40, 20), evidenceRef: 'synthetic:a2' },
      { ...sample('b1', 'app-b', 40, 20), evidenceRef: 'synthetic:b1' },
    ]);
    expect(summary.metrics[0]?.result).toBe('INSUFFICIENT_EVIDENCE');
  });


  test('immutable benchmark evidence rejects conflicting content for the same evidence id', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-benchmark-store-'));
    try {
      const store = new BenchmarkEvidenceStore(root);
      const original = sample('stable-id', 'app-a', 40, 20);
      const firstPath = store.appendComparative(original);
      expect(store.appendComparative(original)).toBe(firstPath);
      expect(() => store.appendComparative({ ...original, testigentValue: 21 })).toThrow(/BENCHMARK_EVIDENCE_CONFLICT/);
      expect(store.comparative()).toEqual([original]);
      expect(() => store.appendComparative({ ...original, id: '..' })).toThrow(/Unsafe benchmark path segment/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('zero baseline does not manufacture a percentage-based product claim', () => {
    const summary = summarizeComparativeBenchmark([
      sample('z1', 'app-a', 0, 0),
      sample('z2', 'app-a', 0, 0),
      sample('z3', 'app-b', 0, 0),
    ]);
    expect(summary.metrics[0]?.result).toBe('INSUFFICIENT_EVIDENCE');
  });


  test('keeps unrelated dataset versions and baseline labels out of one differentiation claim', () => {
    const summary = summarizeComparativeBenchmark([
      sample('d1-a', 'app-a', 40, 20),
      sample('d1-b', 'app-b', 50, 25),
      { ...sample('d2-a', 'app-a', 10, 9), datasetVersion: 'pilot-v2' },
      { ...sample('d2-b', 'app-b', 12, 10), datasetVersion: 'pilot-v2' },
    ]);
    expect(summary.metrics).toHaveLength(2);
    expect(summary.metrics.every(metric => metric.samples === 2)).toBe(true);
    expect(summary.metrics.every(metric => metric.result === 'INSUFFICIENT_EVIDENCE')).toBe(true);
  });

  test('persists false-heal evidence immutably and rejects incomplete claim provenance', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-false-heal-store-'));
    try {
      const store = new BenchmarkEvidenceStore(root);
      const evidence = falseHealEvidence('fh-stable');
      const firstPath = store.appendFalseHeal(evidence);
      expect(store.appendFalseHeal(evidence)).toBe(firstPath);
      expect(store.falseHeal()).toEqual([evidence]);
      expect(() => store.appendFalseHeal({ ...evidence, scenarios: [{ ...evidence.scenarios[0]!, observedAutomationOutcome: 'HEALED_PASS' }] })).toThrow(/BENCHMARK_EVIDENCE_CONFLICT/);
      expect(() => store.appendFalseHeal({ ...evidence, id: '..' })).toThrow(/Unsafe benchmark path segment/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('incomplete provenance is visible but never qualifies as comparative evidence', () => {
    const incomplete = { ...sample('a1', 'app-a', 40, 20), commit: 'unavailable' };
    const summary = summarizeComparativeBenchmark([
      incomplete,
      sample('a2', 'app-a', 40, 20),
      sample('b1', 'app-b', 40, 20),
    ]);
    expect(summary.differentiationStatus).toBe('INSUFFICIENT_EVIDENCE');
    expect(summary.metrics[0]?.result).toBe('INSUFFICIENT_EVIDENCE');
  });

  test('seeded business failures measure false heals separately from valid recovery', () => {
    expect(evaluateFalseHealSafety([
      { id: '1', injectedFault: 'business post-condition rejected', expectedBusinessOutcome: 'FAIL', observedAutomationOutcome: 'FAILED' },
      { id: '2', injectedFault: 'wrong AI recovery', expectedBusinessOutcome: 'FAIL', observedAutomationOutcome: 'HEALED_PASS' },
    ])).toMatchObject({ injectedBusinessFailures: 2, falseHeals: 1, falseHealRatePercent: 50, status: 'FAIL' });
  });

  test('2,000-case planning preserves every independent case while measured evidence controls certification', () => {
    const plan = buildSyntheticScalePlan(2000, 8);
    const keys = plan.flatMap(shard => shard.items.map(item => item.key));
    expect(keys).toHaveLength(2000);
    expect(new Set(keys).size).toBe(2000);

    const measured = scaleEvidence({ caseCount: 500, executedCases: 500, shardDurationsMs: [100_000, 101_000, 99_000, 100_500] });
    expect(evaluateScaleEvidence(measured).status).toBe('PASS');
    expect(evaluateScaleEvidence({ ...measured, synthetic: true }).status).toBe('INSUFFICIENT_EVIDENCE');
    expect(evaluateScaleEvidence({ ...measured, executedCases: 499, droppedCases: 1 }).status).toBe('FAIL');
    expect(() => evaluateScaleEvidence({ ...measured, wallClockMs: 0, shardDurationsMs: [0, 0, 0, 0] })).toThrow(/positive measured duration/);
  });
});

function sample(id: string, application: string, baselineValue: number, testigentValue: number): ComparativeBenchmarkSample {
  return { schemaVersion: 1, id, application, datasetVersion: 'pilot-v1', metric: 'triage-minutes', unit: 'minutes', baselineLabel: 'plain-playwright', baselineValue, testigentValue, productVersion: '1.8.0', commit: 'abcdef1234567890', runtime: 'node v22.16.0', platform: 'linux-x64', environmentDescription: 'controlled-ci-runner', methodology: 'same requirement and acceptance criteria; median engineer minutes', evidenceRef: `artifact://pilot/${id}`, evidenceSha256: 'a'.repeat(64) };
}
function scaleEvidence(overrides: Partial<ScaleExecutionEvidence>): ScaleExecutionEvidence {
  return { schemaVersion: 1, id: 'scale-500', application: 'demo', environment: 'qa', datasetVersion: 'scale-v1', selection: '500 independent browser cases', caseCount: 500, executedCases: 500, duplicateCases: 0, droppedCases: 0, workers: 4, shards: 4, wallClockMs: 110_000, shardDurationsMs: [100_000, 101_000, 99_000, 100_500], productVersion: '1.8.0', commit: 'abcdef1234567890', runtime: 'node v22.16.0', platform: 'linux-x64', environmentDescription: 'controlled-ci-runner', methodology: 'measured browser execution with identical dataset and no retries', evidenceRef: 'ci://run/scale-500', evidenceSha256: 'b'.repeat(64), ...overrides };
}

function falseHealEvidence(id: string): FalseHealBenchmarkEvidence {
  return {
    schemaVersion: 1,
    id,
    application: 'demo',
    environment: 'qa',
    datasetVersion: 'false-heal-v1',
    scenarios: [{ id: 'business-defect-1', injectedFault: 'seeded business post-condition defect', expectedBusinessOutcome: 'FAIL', observedAutomationOutcome: 'FAILED' }],
    productVersion: '1.8.0',
    commit: 'abcdef1234567890',
    runtime: 'node v22.16.0',
    platform: 'linux-x64',
    environmentDescription: 'controlled-ci-runner',
    methodology: 'seed genuine business failures and assert automation remains failed',
    evidenceRef: `artifact://false-heal/${id}`,
    evidenceSha256: 'c'.repeat(64),
  };
}
