import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AgentDecisionLedger } from '../../src/framework/agentic/evidence/agent-decision-ledger.js';
import { spawn } from 'node:child_process';

function base() {
  return { id: 'decision-fixed', timestamp: '2026-09-13T12:00:00.000Z', runId: 'run-1', application: 'demo', environment: 'qa', agent: 'planner' as const, operation: 'plan', state: 'ACCEPTED' as const, rationale: 'Plan created for user@example.com token=super-secret-value', confidence: 0.9, policyPassed: true, deterministicValidationPassed: true, humanApprovalRequired: false, humanApproved: false, evidence: [{ kind: 'requirement' as const, ref: 'REQ-1' }], affectedArtifacts: ['S1'] };
}


function runConcurrentWriter(helper: string, root: string, index: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let stderr = '';

    const child = spawn(
      process.execPath,
      ['--import=tsx', helper, root, `decision-${index}`, String(index)],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          AGENTIC_LEDGER_LOCK_TIMEOUT_MS: '10000',
        },
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );

    child.stderr?.setEncoding('utf8');
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `Concurrent ledger writer failed: code=${String(code)} signal=${String(signal)} stderr=${stderr}`,
        ),
      );
    });
  });
}

test.describe('Agent decision ledger contract', () => {
  test('persists sanitized immutable evidence and deterministic summary', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-ledger-'));
    try {
      const ledger = new AgentDecisionLedger(dir);
      ledger.append(base());
      const records = ledger.read();
      expect(records).toHaveLength(1);
      expect(records[0]?.rationale).not.toContain('user@example.com');
      expect(records[0]?.rationale).not.toContain('super-secret-value');
      expect(ledger.summary()).toMatchObject({ status: 'ACCEPTED', decisions: 1, trusted: 1 });
      expect(fs.existsSync(path.join(dir, 'agent-decision-ledger.jsonl'))).toBe(true);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
  test('unknown agent kinds are ignored instead of entering trusted summaries', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-ledger-invalid-agent-'));
    try {
      const ledger = new AgentDecisionLedger(dir);
      fs.mkdirSync(path.join(dir, 'decisions'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'decisions', 'invalid.json'), JSON.stringify({ ...base(), agent: 'unknown-agent', version: 1 }));
      expect(ledger.read()).toEqual([]);
      expect(ledger.summary()).toMatchObject({ status: 'NO_ACTIVITY', decisions: 0 });
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('conflicting immutable decision id fails closed', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-ledger-conflict-'));
    try {
      const ledger = new AgentDecisionLedger(dir);
      ledger.append(base());
      expect(() => ledger.append({ ...base(), rationale: 'different rationale' })).toThrow(/AGENT_DECISION_CONFLICT/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('parallel processes preserve all immutable decisions and publish a complete JSONL view', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-ledger-concurrent-'));

    try {
      const helper = path.resolve(
        process.cwd(),
        'tests/helpers/agent-ledger-writer.ts',
      );
      const writerCount = 12;

      await Promise.all(
        Array.from(
          { length: writerCount },
          (_, index) => runConcurrentWriter(helper, dir, index),
        ),
      );

      const ledger = new AgentDecisionLedger(dir);
      const records = ledger.read();

      expect(records).toHaveLength(writerCount);
      expect(new Set(records.map(record => record.id)).size).toBe(writerCount);

      const jsonlPath = path.join(dir, 'agent-decision-ledger.jsonl');
      expect(fs.existsSync(jsonlPath)).toBe(true);

      const lines = fs.readFileSync(jsonlPath, 'utf8')
        .split('\n')
        .filter(Boolean);

      expect(lines).toHaveLength(writerCount);

      const exported = lines.map(
        line => JSON.parse(line) as { id?: string },
      );

      expect(new Set(exported.map(record => record.id)).size).toBe(writerCount);

      expect(
        fs.existsSync(path.join(dir, '.agent-decision-ledger.lock')),
      ).toBe(false);

      expect(
        fs.readdirSync(dir).some(name => name.endsWith('.tmp')),
      ).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

});
