import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AdoptionObservationStore } from '../../src/framework/adoption/adoption-store.js';
import { analyzeAdoption } from '../../src/framework/adoption/adoption-analyzer.js';
import type { AdoptionObservation } from '../../src/framework/adoption/adoption.types.js';

test.describe('Adoption intelligence contract', () => {
  test('stores sanitized immutable observations and rejects PII contributor identifiers', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-adoption-'));
    try {
      const store = new AdoptionObservationStore(dir);
      const first = store.append({ id: 'obs-1', recordedAt: '2026-09-14T00:00:00.000Z', application: 'app-a', environment: 'qa', metric: 'triage-minutes', value: 7, unit: 'minutes', source: 'measured', contributorKey: 'engineer-1', baselineValue: 20, note: 'Contact user@example.com token=secret-value', evidenceRef: 'evidence/run-1.json' });
      expect(first.note).not.toContain('user@example.com');
      expect(first.note).not.toContain('secret-value');
      expect(store.read()).toHaveLength(1);
      expect(fs.existsSync(path.join(dir, 'adoption-observations.jsonl'))).toBe(true);
      expect(() => store.append({ id: 'obs-1', recordedAt: '2026-09-14T00:00:00.000Z', application: 'app-a', environment: 'qa', metric: 'triage-minutes', value: 8, unit: 'minutes', source: 'measured', contributorKey: 'engineer-1' })).toThrow(/ADOPTION_OBSERVATION_CONFLICT/);
      expect(() => store.append({ id: 'obs-2', application: 'app-a', environment: 'qa', metric: 'triage-minutes', value: 8, unit: 'minutes', source: 'measured', contributorKey: 'person@example.com' })).toThrow(/non-PII opaque alias/);
      expect(() => AdoptionObservationStore.forScope(dir, '..', 'qa')).toThrow(/Unsafe application/);
      expect(() => store.append({ id: '..', application: 'app-a', environment: 'qa', metric: 'triage-minutes', value: 8, unit: 'minutes', source: 'measured', contributorKey: 'engineer-2' })).toThrow(/Unsafe observation id/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });


  test('aggregates pilot evidence across project-owned stores for the same environment', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-adoption-portfolio-'));
    try {
      AdoptionObservationStore.forScope(workspace, 'app-a', 'qa').append({ id: 'a', recordedAt: '2026-09-14T00:00:00.000Z', application: 'app-a', environment: 'qa', metric: 'triage-minutes', value: 8, unit: 'minutes', source: 'measured', contributorKey: 'engineer-1', baselineValue: 20, evidenceRef: 'evidence/a.json' });
      AdoptionObservationStore.forScope(workspace, 'app-b', 'qa').append({ id: 'b', recordedAt: '2026-09-14T00:01:00.000Z', application: 'app-b', environment: 'qa', metric: 'triage-minutes', value: 9, unit: 'minutes', source: 'measured', contributorKey: 'engineer-2', baselineValue: 22, evidenceRef: 'evidence/b.json' });
      const observations = AdoptionObservationStore.readWorkspace(workspace, 'qa');
      expect(observations.map(item => item.application).sort()).toEqual(['app-a', 'app-b']);
      expect(AdoptionObservationStore.readWorkspace(workspace, 'prod')).toHaveLength(0);
    } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
  });

  test('promotes comparative pilot claims only with two applications, two contributors and enough baseline-backed samples', () => {
    const observations: AdoptionObservation[] = [
      observation('1', 'app-a', 'engineer-1', 8, 20),
      observation('2', 'app-a', 'engineer-2', 9, 21),
      observation('3', 'app-b', 'engineer-1', 10, 24),
      observation('4', 'app-b', 'engineer-2', 11, 25),
    ];
    const summary = analyzeAdoption(observations);
    expect(summary.pilotStatus).toBe('PILOT_EVIDENCE_READY');
    expect(summary.metrics[0]).toMatchObject({ metric: 'triage-minutes', samples: 4, claimStatus: 'IMPROVED' });
    expect(summary.metrics[0]?.medianDeltaPercent).toBeLessThan(0);
  });

  test('keeps sparse measurements as insufficient evidence instead of marketing claims', () => {
    const summary = analyzeAdoption([observation('1', 'app-a', 'engineer-1', 8, 20)]);
    expect(summary.pilotStatus).toBe('INSUFFICIENT_EVIDENCE');
    expect(summary.metrics[0]?.claimStatus).toBe('INSUFFICIENT_EVIDENCE');
  });
});

function observation(id: string, application: string, contributorKey: string, value: number, baselineValue: number): AdoptionObservation {
  return { schemaVersion: 1, id, recordedAt: `2026-09-14T00:00:0${Number(id) || 0}.000Z`, application, environment: 'qa', metric: 'triage-minutes', value, unit: 'minutes', source: 'measured', contributorKey, baselineValue, evidenceRef: `evidence/${id}.json` };
}
