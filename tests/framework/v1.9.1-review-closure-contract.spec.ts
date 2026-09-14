import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateSchemaValue } from '../../src/framework/api-contract/schema-validator.js';
import { loadOpenApiDocument } from '../../src/framework/api-contract/openapi-loader.js';
import { detectBreakingChanges } from '../../src/framework/api-contract/breaking-change-detector.js';
import type { OpenApiDocument } from '../../src/framework/api-contract/openapi.types.js';
import { resolveMcpRequirementPath } from '../../src/framework/mcp/security-policy.js';
import { assertAgenticTargetPath } from '../../src/framework/agentic/policy/path-policy.js';
import { buildPostgresPoolConfig } from '../../src/framework/database/postgres.database.js';
import { buildMssqlPoolConfig } from '../../src/framework/database/mssql.database.js';
import { buildMysqlPoolConfig } from '../../src/framework/database/mysql.database.js';
import { rewriteQuestionMarkParameters } from '../../src/framework/database/sql-placeholder.js';
import { classifyFailureDeterministically } from '../../src/framework/failure-intelligence/deterministic-classifier.js';
import { analyzeFailureIntelligence } from '../../src/framework/failure-intelligence/failure-analyzer.js';
import { FailureHistoryStore } from '../../src/framework/failure-intelligence/failure-history.store.js';
import type { FailureSignal } from '../../src/framework/failure-intelligence/failure-intelligence.types.js';
import { invokeAgenticMcpTool } from '../../src/framework/mcp/tool-registry.js';
import { createAgenticMcpSession, handleAgenticMcpMessage, TESTIGENT_MCP_PROTOCOL_VERSION, validateMcpLineSize } from '../../src/framework/mcp/server.js';
import { spreadsheetSafeCsvCell } from '../../src/framework/reporting/business-dashboard.writer.js';
import { AgentDecisionLedger } from '../../src/framework/agentic/evidence/agent-decision-ledger.js';
import { AdoptionObservationStore } from '../../src/framework/adoption/adoption-store.js';

const liveBase: FailureSignal = { scenarioId: 'R', title: 'Create order', application: 'orders', project: 'checkout', businessStep: 'Submit order', error: 'server returned internal error', endpoint: '/orders/7', httpStatus: 500, authStatus: 'VALID', traceRef: 'evidence/order-trace.zip', evidenceMode: 'LIVE', synthetic: false, claimEligible: true };

test.describe('v1.9.1 independent review closure', () => {
  test('R01 schema validation fails closed for reviewer counterexamples', () => {
    const doc: OpenApiDocument = { openapi: '3.1.0', paths: {} };
    expect(validateSchemaValue(doc, { type: 'integer', minimum: 1 }, -5).map(x => x.rule)).toContain('minimum');
    expect(validateSchemaValue(doc, { type: 'object', additionalProperties: false }, { unexpected: 1 }).map(x => x.rule)).toContain('additionalProperties');
    expect(validateSchemaValue(doc, { type: 'object', required: ['id'], allOf: [{ type: 'object' }] }, {}).map(x => x.rule)).toContain('required');
    expect(validateSchemaValue(doc, { type: ['string', 'null'] }, 42).map(x => x.rule)).toContain('type');
    expect(validateSchemaValue(doc, { type: 'string', const: 'x' } as never, 'x').map(x => x.rule)).toContain('unsupported');
    const unsupported = path.join(os.tmpdir(), `testigent-openapi-${process.pid}.json`);
    fs.writeFileSync(unsupported, JSON.stringify({ openapi: '3.2.0', paths: {} }));
    try { expect(() => loadOpenApiDocument(unsupported)).toThrow(/supported OpenAPI 3\.0\.x or 3\.1\.x/); } finally { fs.rmSync(unsupported, { force: true }); }
  });

  test('R02 detects required parameters and terminates on recursive schemas', () => {
    const previous = recursiveDocument();
    const current = structuredClone(previous);
    (current.paths['/nodes']!.get as any).parameters = [{ name: 'tenant', in: 'query', required: true, schema: { type: 'string' } }];
    expect(detectBreakingChanges(previous, current).some(x => x.kind === 'REQUIRED_PARAMETER_ADDED')).toBe(true);
    expect(detectBreakingChanges(previous, structuredClone(previous))).toEqual([]);
  });

  test('R03 database TLS verifies peers by default and forbids insecure CI overrides', () => {
    const env = { DB_SSL: 'true', DB_HOST: 'db.local' } as NodeJS.ProcessEnv;
    expect((buildPostgresPoolConfig(env).ssl as any).rejectUnauthorized).toBe(true);
    expect((buildMssqlPoolConfig(env).options as any).trustServerCertificate).toBe(false);
    expect((buildMysqlPoolConfig(env).ssl as any).rejectUnauthorized).toBe(true);
    expect(() => buildPostgresPoolConfig({ ...env, CI: 'true', DB_TLS_ALLOW_INSECURE: 'true' })).toThrow(/DB_TLS_POLICY/);
    expect((buildPostgresPoolConfig({ ...env, DB_TLS_ALLOW_INSECURE: 'true' }).ssl as any).rejectUnauthorized).toBe(false);
  });

  test('R04 canonical project boundaries reject traversal, Windows separators and cross-project symlinks', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-path-'));
    try {
      fs.mkdirSync(path.join(root, 'projects/demo/requirements'), { recursive: true });
      fs.mkdirSync(path.join(root, 'projects/demo/src'), { recursive: true });
      fs.mkdirSync(path.join(root, 'projects/other/requirements'), { recursive: true });
      fs.writeFileSync(path.join(root, 'projects/other/requirements/other.md'), '# other');
      expect(() => assertAgenticTargetPath(root, 'demo', 'projects/demo/../other/src/new.ts')).toThrow();
      expect(() => assertAgenticTargetPath(root, 'demo', 'projects\\demo\\..\\other\\src\\new.ts')).toThrow();
      if (process.platform !== 'win32') {
        fs.symlinkSync(path.join(root, 'projects/other/requirements/other.md'), path.join(root, 'projects/demo/requirements/link.md'));
        expect(() => resolveMcpRequirementPath(root, 'demo', 'link.md')).toThrow(/canonical boundary|escapes|symlink|junction/i);
      }
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test('R05 MCP caller evidence is strict, UNVERIFIED and never claim eligible', async () => {
    const context = { root: process.cwd(), runId: 'review', environment: 'qa' };
    await expect(invokeAgenticMcpTool('testigent_explain_failure', { signal: { scenarioId: 'M1', title: 'Known issue', application: 'demo', knownDefectId: 'BUG-1', evidenceMode: 'SHOWCASE' } }, context)).rejects.toThrow(/unsupported field/);
    const value = await invokeAgenticMcpTool('testigent_explain_failure', { signal: { scenarioId: 'M2', title: 'Known issue', application: 'demo', knownDefectId: 'BUG-1' } }, context) as any;
    expect(value).toMatchObject({ category: 'KNOWN_DEFECT', evidenceMode: 'UNVERIFIED', claimEligible: false, confidence: 'LOW' });
  });

  test('R06 classification output is centrally redacted before MCP/report/history boundaries', () => {
    const result = classifyFailureDeterministically({ ...liveBase, title: 'token=probe-only-secret', contractViolation: 'schema token=probe-only-secret', endpoint: 'https://api.test/orders?token=probe-only-secret' });
    expect(JSON.stringify(result)).not.toContain('probe-only-secret');
    expect(result.rationale).toContain('[REDACTED]');
    expect(result.evidenceRefs.join(' ')).toContain('[REDACTED]');
  });

  test('R07 ambiguous text symptoms abstain instead of claiming HIGH-confidence root cause', () => {
    for (const signal of [
      { scenarioId: 'A1', title: 'Tab', application: 'demo', error: 'Timeout waiting for contract tab' },
      { scenarioId: 'A2', title: '503', application: 'demo', error: 'service failed', httpStatus: 503, authStatus: 'VALID' as const },
      { scenarioId: 'A3', title: 'UI', application: 'demo', error: 'element not found' },
    ]) {
      const result = classifyFailureDeterministically(signal);
      expect(result.category).toBe('UNKNOWN'); expect(result.claimEligible).toBe(false); expect(result.confidence).toBe('INSUFFICIENT_EVIDENCE');
    }
  });

  test('R08 contradictory categories never merge by input order', () => {
    const known: FailureSignal = { scenarioId: 'K', title: 'same', application: 'demo', error: 'intermittent timeout', knownDefectId: 'BUG-9', evidenceMode: 'LIVE', claimEligible: true, synthetic: false };
    const flaky: FailureSignal = { scenarioId: 'F', title: 'same', application: 'demo', error: 'intermittent timeout', flaky: true, retriesUsed: 1, evidenceMode: 'LIVE', claimEligible: true, synthetic: false };
    const a = analyzeFailureIntelligence([known, flaky]); const b = analyzeFailureIntelligence([flaky, known]);
    expect(a.uniqueIncidents).toBe(2); expect(b.uniqueIncidents).toBe(2);
    expect(a.clusters.map(x => `${x.category}:${x.fingerprint}`).sort()).toEqual(b.clusters.map(x => `${x.category}:${x.fingerprint}`).sort());
    expect(a.classifications[0]!.symptomFingerprint).toBe(a.classifications[1]!.symptomFingerprint);
  });

  test('R09 occurrence history records recurrence, replay is idempotent and corruption is observable', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-history-'));
    try {
      const store = new FailureHistoryStore(dir); const live = classifyFailureDeterministically(liveBase);
      for (let i = 1; i <= 3; i++) store.append(live, { runId: `run-${i}`, attempt: 0, recordedAt: `2026-09-14T00:00:0${i}.000Z`, project: 'checkout', environment: 'qa' });
      store.append(live, { runId: 'run-1', attempt: 0, recordedAt: '2026-09-14T01:00:00.000Z', project: 'checkout', environment: 'qa' });
      expect(store.readOccurrences()).toHaveLength(3); expect(store.similarOccurrences(live.fingerprint)).toHaveLength(3);
      expect(() => store.append({ ...live, evidenceMode: 'SHOWCASE', synthetic: true, claimEligible: false }, { runId: 'showcase' })).toThrow(/TRUST_BOUNDARY/);
      fs.writeFileSync(path.join(dir, 'failure-intelligence/live/corrupt.json'), '{');
      expect(() => store.readOccurrences()).toThrow(/FAILURE_HISTORY_CORRUPT/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('R10 SQL rewriting preserves literals, comments, dollar strings and PostgreSQL JSON operators', () => {
    expect(rewriteQuestionMarkParameters("SELECT '?' AS label WHERE id = ?", i => `$${i + 1}`, { preservePostgresJsonOperators: true })).toEqual({ sql: "SELECT '?' AS label WHERE id = $1", count: 1 });
    expect(rewriteQuestionMarkParameters("SELECT data ? 'key' FROM t WHERE id = ? -- ?\n", i => `$${i + 1}`, { preservePostgresJsonOperators: true })).toEqual({ sql: "SELECT data ? 'key' FROM t WHERE id = $1 -- ?\n", count: 1 });
    expect(rewriteQuestionMarkParameters("SELECT $$?$$, col FROM t WHERE id = ? /* ? */", i => `@p${i}`)).toEqual({ sql: "SELECT $$?$$, col FROM t WHERE id = @p0 /* ? */", count: 1 });
  });

  test('R11 spreadsheet CSV neutralizes formula-shaped text without changing JSON source data', () => {
    for (const value of ['=1+1', '+SUM(A1:A2)', '-10+20', '@cmd', '  =1+1', '\t=1+1']) expect(spreadsheetSafeCsvCell(value)).toContain("'");
    expect(spreadsheetSafeCsvCell('plain')).toBe('"plain"');
    expect(spreadsheetSafeCsvCell('a"b')).toBe('"a""b"');
  });

  test('R12 MCP malformed input, lifecycle, strict args, size budget and package version are enforced', async () => {
    const context = { root: process.cwd(), runId: 'mcp', environment: 'qa' };
    const invalid = await handleAgenticMcpMessage(null, context); expect(invalid && 'error' in invalid ? invalid.error.code : 0).toBe(-32600);
    const session = createAgenticMcpSession(false);
    const before = await handleAgenticMcpMessage({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }, context, session); expect(before && 'error' in before ? before.error.code : 0).toBe(-32002);
    await handleAgenticMcpMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, context, session);
    const stillBefore = await handleAgenticMcpMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, context, session); expect(stillBefore && 'error' in stillBefore ? stillBefore.error.code : 0).toBe(-32002);
    const init = await handleAgenticMcpMessage({ jsonrpc: '2.0', id: 3, method: 'initialize', params: { protocolVersion: TESTIGENT_MCP_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'closure', version: '1' } } }, context, session) as any;
    const packageVersion = (JSON.parse(fs.readFileSync('package.json', 'utf8')) as { version: string }).version; expect(init.result.serverInfo.version).toBe(packageVersion);
    const notReady = await handleAgenticMcpMessage({ jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} }, context, session); expect(notReady && 'error' in notReady ? notReady.error.code : 0).toBe(-32002);
    await handleAgenticMcpMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, context, session);
    const ready = await handleAgenticMcpMessage({ jsonrpc: '2.0', id: 5, method: 'tools/list', params: {} }, context, session); expect(ready && 'result' in ready).toBe(true);
    expect(() => validateMcpLineSize('12345', 4)).toThrow(/exceeds/);
    await expect(invokeAgenticMcpTool('testigent_list_projects', { extra: true }, context)).rejects.toThrow(/unsupported field/);
  });

  test('R13 append paths are incremental and corrupt evidence is observable', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-stores-'));
    try {
      const ledger = new AgentDecisionLedger(path.join(dir, 'ledger'));
      for (let i = 0; i < 3; i++) ledger.append({ id: `d-${i}`, timestamp: `2026-09-14T00:00:0${i}.000Z`, runId: 'run', application: 'demo', environment: 'qa', agent: 'planner', operation: 'plan', state: 'ACCEPTED', rationale: 'ok', confidence: 1, policyPassed: true, deterministicValidationPassed: true, humanApprovalRequired: false, humanApproved: false, evidence: [], affectedArtifacts: [] });
      const ledgerJsonl = path.join(dir, 'ledger/agent-decision-ledger.jsonl');
      expect(fs.readFileSync(ledgerJsonl, 'utf8').trim().split(/\r?\n/)).toHaveLength(3);
      // Simulate a process dying after the authoritative record was promoted but before its JSONL convenience line.
      fs.writeFileSync(ledgerJsonl, '');
      ledger.append({ id: 'd-0', timestamp: '2026-09-14T00:00:00.000Z', runId: 'run', application: 'demo', environment: 'qa', agent: 'planner', operation: 'plan', state: 'ACCEPTED', rationale: 'ok', confidence: 1, policyPassed: true, deterministicValidationPassed: true, humanApprovalRequired: false, humanApproved: false, evidence: [], affectedArtifacts: [] });
      expect(fs.readFileSync(ledgerJsonl, 'utf8')).toContain('\"id\":\"d-0\"');
      fs.writeFileSync(path.join(dir, 'ledger/decisions/bad.json'), '{'); expect(() => ledger.read()).toThrow(/AGENT_DECISION_LEDGER_CORRUPT/);
      const adoption = new AdoptionObservationStore(path.join(dir, 'adoption'));
      adoption.append({ id: 'a', recordedAt: '2026-09-14T00:00:00.000Z', application: 'demo', environment: 'qa', metric: 'triage-minutes', value: 1, unit: 'minutes', source: 'measured' });
      fs.writeFileSync(path.join(dir, 'adoption/observations/bad.json'), '{'); expect(() => adoption.read()).toThrow(/ADOPTION_OBSERVATION_CORRUPT/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('R14 release gate rejects floating GitHub Action references', () => {
    expect(() => execFileSync(process.execPath, ['scripts/github-action-pin-check.mjs'], { cwd: process.cwd(), stdio: 'pipe' })).not.toThrow();
    const refs = fs.readdirSync('.github/workflows').filter(x => x.endsWith('.yml')).flatMap(name => fs.readFileSync(path.join('.github/workflows', name), 'utf8').match(/uses:\s*([^\s#]+)/g) ?? []);
    expect(refs.filter(ref => !ref.includes('uses: ./')).every(ref => /@[0-9a-f]{40}$/i.test(ref.split(/\s+/).at(-1)!))).toBe(true);
  });
});

function recursiveDocument(): OpenApiDocument {
  return { openapi: '3.0.3', components: { schemas: { Node: { type: 'object', properties: { value: { type: 'string' }, next: { $ref: '#/components/schemas/Node' } } } } }, paths: { '/nodes': { get: { responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Node' } } } } } } } } };
}
