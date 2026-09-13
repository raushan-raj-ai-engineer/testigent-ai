import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { AiProviderHealthStore, summarizeAiProviderHealth, type AiProviderCanaryRecord } from '../../src/framework/ai/ai-provider-health.store';
import { renderAiProviderHealthHtml } from '../../src/framework/reporting/ai-provider-health.renderer';
import { selectProviderCanary } from '../../scripts/ci-provider-health';

test.describe('AI operational health contract', () => {
  test('live-provider degradation is observable but separate from deterministic release facts', async () => {
    const records: AiProviderCanaryRecord[] = [record('run-1', 'HEALTHY', 120), record('run-2', 'DEGRADED')];
    const summary = summarizeAiProviderHealth(records);
    expect(summary.status).toBe('DEGRADED');
    expect(summary.availabilityPercent).toBe(50);
    expect(renderAiProviderHealthHtml(summary)).toContain('does not rewrite deterministic test outcomes');
  });

  test('CI canary selection uses newest same-workflow evidence and fails closed when expected evidence is missing', async () => {
    const records = [
      record('900-1', 'DEGRADED'),
      record('900-2', 'HEALTHY', 80),
      record('999-3', 'HEALTHY', 10)
    ];
    expect(selectProviderCanary(records, '900', 2, true, 'demo', 'qa')?.runId).toBe('900-2');
    expect(selectProviderCanary(records, '900', 1, true, 'demo', 'qa')?.runId).toBe('900-1');
    expect(selectProviderCanary(records, '901', 1, false, 'demo', 'qa')).toBeUndefined();
    expect(() => selectProviderCanary(records, '901', 1, true, 'demo', 'qa')).toThrow(/AI_PROVIDER_CANARY_MISSING/);
    expect(() => selectProviderCanary([{ ...record('900-2', 'HEALTHY'), application: 'other-app' }], '900', 2, true, 'demo', 'qa')).toThrow(/AI_PROVIDER_CANARY_MISSING/);
    expect(() => selectProviderCanary([{ ...record('900-2', 'HEALTHY'), status: 'BROKEN' }], '900', 2, true, 'demo', 'qa')).toThrow(/AI_PROVIDER_CANARY_MISSING/);
    expect(() => selectProviderCanary([{ ...record('900-2', 'HEALTHY'), providerCheckOutcome: 'failed' }], '900', 2, true, 'demo', 'qa')).toThrow(/AI_PROVIDER_CANARY_MISSING/);
    expect(() => selectProviderCanary([{ ...record('900-2', 'DEGRADED'), providerCheckOutcome: 'passed', healingOutcome: 'passed' }], '900', 2, true, 'demo', 'qa')).toThrow(/AI_PROVIDER_CANARY_MISSING/);
    expect(() => selectProviderCanary(records, undefined, 2, true, 'demo', 'qa')).toThrow(/AI_PROVIDER_CANARY_IDENTITY_MISSING/);
  });

  test('GitHub step outcome vocabulary produces coherent degraded canary evidence', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-ai-canary-outcome-'));

    try {
      const recordFile = path.join(dir, 'ai-provider-canary.json');

      execFileSync(
        process.platform === 'win32' ? 'npm.cmd' : 'npm',
        [
          'exec',
          '--',
          'tsx',
          'scripts/ai-canary-finalize.ts'
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            APP: 'demo',
            ENV: 'qa',
            RUN_ID: '900-1',
            GITHUB_RUN_ID: '900',
            GITHUB_RUN_ATTEMPT: '1',
            AI_PROVIDER_MODE: 'single',
            AI_PROVIDER: 'gemini',
            GEMINI_MODEL: 'contract-model',
            AI_CANARY_RECORD_FILE: recordFile,
            AI_CANARY_HAS_TESTS: 'true',
            AI_CANARY_CONFIG_OUTCOME: 'success',
            AI_CANARY_PROVIDER_OUTCOME: 'failure',
            AI_CANARY_HEALING_OUTCOME: 'skipped'
          },
          stdio: 'pipe'
        }
      );

      const record = JSON.parse(fs.readFileSync(recordFile, 'utf8')) as AiProviderCanaryRecord;

      expect(record.status).toBe('DEGRADED');
      expect(record.configurationOutcome).toBe('passed');
      expect(record.providerCheckOutcome).toBe('failed');
      expect(record.healingOutcome).toBe('skipped');

      expect(
        selectProviderCanary([record], '900', 1, true, 'demo', 'qa')?.status
      ).toBe('DEGRADED');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('environment-scoped health history de-duplicates rerun records and keeps newest evidence', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-ai-health-'));
    try {
      const file = path.join(dir, 'health.json');
      const store = new AiProviderHealthStore(file);
      store.append(record('900-1', 'DEGRADED'));
      store.append(record('900-1', 'HEALTHY', 90));
      expect(store.read()).toHaveLength(1);
      expect(store.read()[0].status).toBe('HEALTHY');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

function record(runId: string, status: AiProviderCanaryRecord['status'], latency?: number): AiProviderCanaryRecord {
  const attempt = Number(runId.split('-').at(-1)) || 1;
  return { runId, workflowRunId: runId.split('-')[0], attempt, application: 'demo', environment: 'qa', recordedAt: new Date(Date.now() + attempt).toISOString(), status, providerMode: 'single', providers: ['gemini'], model: 'contract-model', configurationOutcome: 'passed', providerCheckOutcome: status === 'HEALTHY' ? 'passed' : 'failed', healingOutcome: status === 'HEALTHY' ? 'passed' : 'failed', generationLatencyMs: latency };
}
