import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { AgentDecisionLedger } from '../../src/framework/agentic/evidence/agent-decision-ledger.js';

function base() {
  return { id: 'decision-fixed', timestamp: '2026-09-13T12:00:00.000Z', runId: 'run-1', application: 'demo', environment: 'qa', agent: 'planner' as const, operation: 'plan', state: 'ACCEPTED' as const, rationale: 'Plan created for user@example.com token=super-secret-value', confidence: 0.9, policyPassed: true, deterministicValidationPassed: true, humanApprovalRequired: false, humanApproved: false, evidence: [{ kind: 'requirement' as const, ref: 'REQ-1' }], affectedArtifacts: ['S1'] };
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
  test('corrupt or schema-invalid decisions fail visibly instead of disappearing from summaries', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-ledger-invalid-agent-'));
    try {
      const ledger = new AgentDecisionLedger(dir);
      fs.mkdirSync(path.join(dir, 'decisions'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'decisions', 'invalid.json'), JSON.stringify({ ...base(), agent: 'unknown-agent', version: 1 }));
      expect(() => ledger.read()).toThrow(/AGENT_DECISION_LEDGER_CORRUPT/);
      expect(() => ledger.summary()).toThrow(/AGENT_DECISION_LEDGER_CORRUPT/);
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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-ledger-parallel-'));
    const helper = path.resolve(process.cwd(), 'tests/helpers/agent-ledger-writer.ts');
    try {
      const writers = Array.from({ length: 12 }, (_, index) => runWriter(helper, dir, index));
      await Promise.all(writers);
      const ledger = new AgentDecisionLedger(dir);
      const records = ledger.read();
      expect(records).toHaveLength(12);
      expect(new Set(records.map(record => record.id)).size).toBe(12);
      const jsonl = fs.readFileSync(path.join(dir, 'agent-decision-ledger.jsonl'), 'utf8').trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as { id: string });
      expect(jsonl).toHaveLength(12);
      expect(new Set(jsonl.map(record => record.id)).size).toBe(12);
      expect(fs.existsSync(path.join(dir, '.agent-decision-ledger.lock'))).toBe(false);
      expect(fs.readdirSync(dir).some(name => name.endsWith('.tmp'))).toBe(false);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

});


function runWriter(helper: string, root: string, index: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import=tsx', helper, root, `decision-${index}`, String(index)], {
      cwd: process.cwd(),
      env: { ...process.env, AGENTIC_LEDGER_LOCK_TIMEOUT_MS: '10000' },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let error = '';
    child.stderr.on('data', chunk => { error += String(chunk); });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`ledger writer ${index} exited ${code}: ${error}`)));
  });
}
