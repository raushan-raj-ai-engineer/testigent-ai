import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { validateResponseContract } from '../../src/framework/api-contract/response-contract-validator.js';
import { detectBreakingChanges } from '../../src/framework/api-contract/breaking-change-detector.js';
import type { OpenApiDocument } from '../../src/framework/api-contract/openapi.types.js';
import { assertAgenticTargetPath, resolveProjectMutationPath } from '../../src/framework/agentic/policy/path-policy.js';
import { resolveMcpRequirementPath } from '../../src/framework/mcp/security-policy.js';
import { buildExecutionFacts } from '../../src/framework/analytics/execution-facts.js';
import type { BusinessTestResult, HealingSummary } from '../../src/framework/analytics/report.types.js';
import { writeBusinessDashboard, spreadsheetSafeCsvCell } from '../../src/framework/reporting/business-dashboard.writer.js';
import { FailureHistoryStore } from '../../src/framework/failure-intelligence/failure-history.store.js';
import { classifyFailure } from '../../src/framework/ai/failure.classifier.js';
import { failureSignalsFromExecutionFacts } from '../../src/framework/failure-intelligence/report-adapter.js';
import { classifyFailureDeterministically } from '../../src/framework/failure-intelligence/deterministic-classifier.js';
import { preparePostgresSql, rewriteQuestionMarkParameters } from '../../src/framework/database/sql-placeholder.js';
import { PostgresDatabaseClient, buildPostgresPoolConfig } from '../../src/framework/database/postgres.database.js';
import { MssqlDatabaseClient, buildMssqlPoolConfig } from '../../src/framework/database/mssql.database.js';
import { buildMysqlPoolConfig } from '../../src/framework/database/mysql.database.js';
import { resolveDatabaseTlsPolicy } from '../../src/framework/database/database-tls.js';
import { createAgenticMcpSession, handleAgenticMcpMessage, TESTIGENT_MCP_PROTOCOL_VERSION } from '../../src/framework/mcp/server.js';

const emptyHealing: HealingSummary = { count: 0, fallback: 0, cache: 0, ai: 0, affectedTests: 0, records: [], attempts: [], attemptCount: 0, rejected: 0, suggested: 0, unverified: 0 };

test.describe('v1.9.2 independent re-review closure', () => {
  test('R01 public response contract honors null enum, ref siblings and boolean schemas', () => {
    const base: OpenApiDocument = {
      openapi: '3.1.0', components: { schemas: { Base: { type: 'integer', minimum: 10 } } },
      paths: { '/value': { get: { responses: { '200': { content: { 'application/json': { schema: { type: ['string', 'null'], enum: ['ok'] } } } } } } } },
    };
    expect(validateResponseContract({ document: base, method: 'GET', path: '/value', status: 200, body: null, contentType: 'application/json' }).violations.map(x => x.rule)).toContain('enum');
    (base.paths['/value']!.get as any).responses['200'].content['application/json'].schema = { $ref: '#/components/schemas/Base', minimum: 1 };
    expect(validateResponseContract({ document: base, method: 'GET', path: '/value', status: 200, body: 5, contentType: 'application/json' }).violations.map(x => x.rule)).toContain('minimum');
    (base.paths['/value']!.get as any).responses['200'].content['application/json'].schema = false;
    expect(validateResponseContract({ document: base, method: 'GET', path: '/value', status: 200, body: 'anything', contentType: 'application/json' })).toMatchObject({ ok: false });
    (base.paths['/value']!.get as any).responses['200'].content['application/json'].schema = true;
    expect(validateResponseContract({ document: base, method: 'GET', path: '/value', status: 200, body: 'anything', contentType: 'application/json' })).toMatchObject({ ok: true });
  });

  test('R02 query names remain case-sensitive, headers case-insensitive and request bounds are directional', () => {
    const previous = apiDoc({ name: 'Tenant', in: 'query', required: true, schema: { type: 'string' } }, { type: 'integer', minimum: 0 });
    const current = apiDoc({ name: 'tenant', in: 'query', required: true, schema: { type: 'string' } }, { type: 'integer', minimum: 10 });
    const changes = detectBreakingChanges(previous, current);
    expect(changes.some(x => x.kind === 'PARAMETER_REMOVED' && x.location.includes('query:Tenant'))).toBe(true);
    expect(changes.some(x => x.kind === 'REQUIRED_PARAMETER_ADDED' && x.location.includes('query:tenant'))).toBe(true);
    expect(changes.some(x => x.kind === 'REQUEST_CONSTRAINT_TIGHTENED' && /lower bound tightened/.test(x.message))).toBe(true);
    const oldHeader = apiDoc({ name: 'X-Tenant', in: 'header', required: true, schema: { type: 'string' } }, { type: 'string' });
    const newHeader = apiDoc({ name: 'x-tenant', in: 'header', required: true, schema: { type: 'string' } }, { type: 'string' });
    expect(detectBreakingChanges(oldHeader, newHeader).filter(x => /parameter/.test(x.location))).toEqual([]);
    const unsupported = structuredClone(previous); ((unsupported.paths['/x']!.post as any).requestBody.content['application/json'].schema as any).not = { type: 'null' };
    expect(detectBreakingChanges(previous, unsupported).some(x => x.kind === 'INCOMPLETE_COMPARISON')).toBe(true);
  });

  test('R04 selected-project boundary rejects project, requirements, source and leaf symlink escapes including future targets', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-r04-'));
    try {
      fs.mkdirSync(path.join(root, 'projects/demo/src'), { recursive: true });
      fs.mkdirSync(path.join(root, 'projects/demo/requirements'), { recursive: true });
      fs.mkdirSync(path.join(root, 'projects/other/src'), { recursive: true });
      fs.mkdirSync(path.join(root, 'projects/other/requirements'), { recursive: true });
      fs.writeFileSync(path.join(root, 'projects/other/requirements/secret.md'), '# secret');
      fs.writeFileSync(path.join(root, 'projects/other/src/existing.ts'), 'export {}');

      makeDirLink(path.join(root, 'projects/other/src'), path.join(root, 'projects/demo/src/linked'));
      expect(() => assertAgenticTargetPath(root, 'demo', 'projects/demo/src/linked/future.ts')).toThrow(/symlink|junction|boundary/i);
      expect(() => resolveProjectMutationPath(root, 'projects/demo/src/linked/future.ts')).toThrow(/symlink|junction|boundary/i);
      fs.rmSync(path.join(root, 'projects/demo/src/linked'), { recursive: true, force: true });

      fs.symlinkSync(path.join(root, 'projects/other/src/existing.ts'), path.join(root, 'projects/demo/src/leaf.ts'), 'file');
      expect(() => assertAgenticTargetPath(root, 'demo', 'projects/demo/src/leaf.ts')).toThrow(/symlink|junction|boundary/i);
      fs.rmSync(path.join(root, 'projects/demo/src/leaf.ts'), { force: true });

      fs.rmSync(path.join(root, 'projects/demo/requirements'), { recursive: true, force: true });
      makeDirLink(path.join(root, 'projects/other/requirements'), path.join(root, 'projects/demo/requirements'));
      expect(() => resolveMcpRequirementPath(root, 'demo', 'secret.md')).toThrow(/symlink|junction|boundary/i);

      makeDirLink(path.join(root, 'projects/other'), path.join(root, 'projects/alias'));
      expect(() => resolveMcpRequirementPath(root, 'alias', 'requirements/secret.md')).toThrow(/symlink|junction|boundary/i);
      expect(() => assertAgenticTargetPath(root, 'demo', 'projects\\demo\\..\\other\\src\\new.ts')).toThrow();
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test('R09 complete dashboard regeneration is idempotent with evidence and immutable history', () => {
    const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-r09-source-'));
    const output = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-r09-report-'));
    const application = `r09-${process.pid}-${Date.now()}`;
    const historyRoot = path.join(process.cwd(), '.report-history', application);
    try {
      const trace = path.join(sourceRoot, 'trace.zip'); const shot = path.join(sourceRoot, 'shot.png');
      fs.writeFileSync(trace, 'trace-bytes'); fs.writeFileSync(shot, 'png-bytes');
      const result: BusinessTestResult = {
        testId: 's1', title: 'Checkout total is correct', project: 'chromium', status: 'failed', rawStatus: 'failed', durationMs: 10, totalDurationMs: 10,
        retriesUsed: 0, flaky: false, tags: ['@critical'], steps: ['Submit order'], stepDetails: [{ title: 'Submit order', category: 'test.step', durationMs: 10, status: 'failed', error: 'Expected total 100 but received 90', children: [] }],
        attachments: [{ name: 'trace', contentType: 'application/zip', sourcePath: trace }, { name: 'screenshot', contentType: 'image/png', sourcePath: shot }],
        error: 'Expected total 100 but received 90', failureCategory: 'PRODUCT_DEFECT', attempts: [{ retry: 0, status: 'failed', durationMs: 10, error: 'Expected total 100 but received 90' }], sourceFile: 'projects/demo/tests/e2e/checkout.spec.ts',
      };
      const facts = buildExecutionFacts({ runId: 'same-run', environment: 'qa', application, results: [result], healing: emptyHealing });
      const first = writeBusinessDashboard(output, facts); const second = writeBusinessDashboard(output, facts);
      const firstRefs = first.results[0]!.attachments!.map(x => x.reportPath); const secondRefs = second.results[0]!.attachments!.map(x => x.reportPath);
      expect(secondRefs).toEqual(firstRefs); expect(secondRefs.join(' ')).not.toContain('-2.');
      const history = FailureHistoryStore.forScope(process.cwd(), application, 'qa').readOccurrences();
      expect(history).toHaveLength(1); expect(history[0]!.runId).toBe('same-run');
      for (const relative of secondRefs) expect(relative && fs.existsSync(path.join(output, relative))).toBe(true);
      expect(fs.existsSync(path.join(output, 'index.html'))).toBe(true);
    } finally { fs.rmSync(sourceRoot, { recursive: true, force: true }); fs.rmSync(output, { recursive: true, force: true }); fs.rmSync(historyRoot, { recursive: true, force: true }); }
  });

  test('R07 legacy classifier hints cannot become structured HIGH-confidence evidence', () => {
    for (const message of ['schema editor failed to load', 'certificate panel failed to render', 'waiting for preferences panel']) {
      const legacy = classifyFailure(message);
      const result: BusinessTestResult = { testId: message, title: 'Ambiguous UI failure', project: 'chromium', status: 'failed', rawStatus: 'failed', durationMs: 1, totalDurationMs: 1, retriesUsed: 0, flaky: false, tags: [], steps: [], stepDetails: [], attachments: [{ name: 'trace', contentType: 'application/zip', reportPath: 'evidence/t.zip' }], error: message, failureCategory: legacy, attempts: [{ retry: 0, status: 'failed', durationMs: 1, error: message }] };
      const facts = buildExecutionFacts({ runId: 'legacy-chain', environment: 'qa', application: 'demo', results: [result], healing: emptyHealing });
      const signal = failureSignalsFromExecutionFacts(facts)[0]!;
      expect(signal.legacyCategoryHint).toBe(legacy); expect(signal.testDataSignal).toBeUndefined(); expect(signal.environmentSignal).toBeUndefined(); expect(signal.locatorSignal).toBeUndefined();
      const classified = classifyFailureDeterministically(signal);
      expect(classified.category).toBe('UNKNOWN'); expect(classified.confidence).toBe('INSUFFICIENT_EVIDENCE'); expect(classified.claimEligible).toBe(false); expect(classified.humanConfirmationRecommended).toBe(true);
    }
  });

  test('R10 SQL lexical handling supports ordinary placeholders, JSON operators, native PostgreSQL parameters and SQL Server brackets through adapters', async () => {
    expect(preparePostgresSql('SELECT ? AS value', 1)).toEqual({ sql: 'SELECT $1 AS value', count: 1 });
    expect(preparePostgresSql('SELECT data ? ? FROM t', 1)).toEqual({ sql: 'SELECT data ? $1 FROM t', count: 1 });
    expect(preparePostgresSql('SELECT data ? $1 FROM t WHERE id = $2', 2)).toEqual({ sql: 'SELECT data ? $1 FROM t WHERE id = $2', count: 2 });
    expect(() => preparePostgresSql('SELECT $2', 1)).toThrow(/missing \$1/); expect(() => preparePostgresSql('SELECT $1, ?', 2)).toThrow(/mix/);
    expect(rewriteQuestionMarkParameters('SELECT [what?] FROM t WHERE id = ?', i => `@p${i}`, { preserveSqlServerBracketIdentifiers: true })).toEqual({ sql: 'SELECT [what?] FROM t WHERE id = @p0', count: 1 });

    const pgCalls: unknown[][] = []; const pg = Object.create(PostgresDatabaseClient.prototype) as PostgresDatabaseClient; (pg as any).pool = { query: async (...args: unknown[]) => { pgCalls.push(args); return { rows: [{ ok: true }] }; } };
    await pg.query('SELECT ? AS value', [7]); expect(pgCalls[0]).toEqual(['SELECT $1 AS value', [7]]);
    await pg.query('SELECT $1 AS value', [8]); expect(pgCalls[1]).toEqual(['SELECT $1 AS value', [8]]);

    const mssqlCalls: string[] = []; const ms = Object.create(MssqlDatabaseClient.prototype) as MssqlDatabaseClient;
    (ms as any).poolPromise = Promise.resolve({ request: () => ({ input: () => undefined, query: async (sql: string) => { mssqlCalls.push(sql); return { recordset: [] }; } }) });
    await ms.query('SELECT [what?] FROM t WHERE id = ?', [1]); expect(mssqlCalls).toEqual(['SELECT [what?] FROM t WHERE id = @p0']);
  });

  test('R03 strict TLS requires encryption, validates modes and retains peer verification across driver configs', () => {
    for (const env of [{ DB_TLS_STRICT: 'true' }, { DB_TLS_STRICT: 'true', DB_SSL: 'false' }]) expect(() => resolveDatabaseTlsPolicy(env as NodeJS.ProcessEnv)).toThrow(/TLS encryption is required/);
    expect(() => resolveDatabaseTlsPolicy({ DB_TLS_STRICT: 'true', DB_SSL: 'tru' } as NodeJS.ProcessEnv)).toThrow(/unsupported DB_SSL mode/);
    const strict = { DB_TLS_STRICT: 'true', DB_SSL: 'true', DB_HOST: 'db.internal' } as NodeJS.ProcessEnv;
    expect(resolveDatabaseTlsPolicy(strict)).toMatchObject({ enabled: true, rejectUnauthorized: true });
    expect((buildPostgresPoolConfig(strict).ssl as any).rejectUnauthorized).toBe(true);
    expect((buildMysqlPoolConfig(strict).ssl as any).rejectUnauthorized).toBe(true);
    expect((buildMssqlPoolConfig(strict).options as any)).toMatchObject({ encrypt: true, trustServerCertificate: false });
    expect(() => resolveDatabaseTlsPolicy({ ...strict, CI: 'true', DB_TLS_ALLOW_INSECURE: 'true' })).toThrow(/certificate verification/);
  });

  test('R12 lifecycle rejects notification-only init and active cancellation reaches in-flight work', async () => {
    const context = { root: process.cwd(), runId: 'mcp-lifecycle', environment: 'qa' }; const session = createAgenticMcpSession(false);
    await handleAgenticMcpMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, context, session);
    const denied = await handleAgenticMcpMessage({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }, context, session) as any; expect(denied.error.code).toBe(-32002);
    await handleAgenticMcpMessage({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: TESTIGENT_MCP_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'contract', version: '1' } } }, context, session);
    expect(session.phase).toBe('INITIALIZE_RESPONDED');
    await handleAgenticMcpMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, context, session); expect(session.phase).toBe('READY');
    let aborted = false;
    const pending = handleAgenticMcpMessage({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'slow', arguments: {} } }, context, session, { invokeTool: async (_name, _args, toolContext) => new Promise((resolve, reject) => { const timer = setTimeout(() => resolve({ late: true }), 2_000); toolContext.abortSignal!.addEventListener('abort', () => { aborted = true; clearTimeout(timer); const error = new Error('cancel'); error.name = 'AbortError'; reject(error); }, { once: true }); }) });
    await handleAgenticMcpMessage({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 9 } }, context, session);
    const cancelled = await pending as any; expect(cancelled.error.code).toBe(-32800); expect(aborted).toBe(true);
  });

  test('R12 real child-process stdio caps unterminated frames and services cancellation at saturation', async () => {
    const cli = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const child = spawn(process.execPath, [cli, path.join(process.cwd(), 'tests/helpers/mcp-stdio-harness.ts')], { cwd: process.cwd(), stdio: ['pipe', 'pipe', 'pipe'] });
    const reader = jsonLineReader(child.stdout!);
    try {
      child.stdin!.write('x'.repeat(513));
      expect((await reader()).error.code).toBe(-32001); // emitted before any newline arrives
      child.stdin!.write('\n');
      child.stdin!.write(jsonLine({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: TESTIGENT_MCP_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'stdio-test', version: '1' } } }));
      expect((await reader()).id).toBe(1);
      child.stdin!.write(jsonLine({ jsonrpc: '2.0', method: 'notifications/initialized' }));
      child.stdin!.write(jsonLine({ jsonrpc: '2.0', id: 20, method: 'tools/call', params: { name: 'slow', arguments: {} } }));
      child.stdin!.write(jsonLine({ jsonrpc: '2.0', id: 21, method: 'tools/list', params: {} }));
      expect((await reader()).error.code).toBe(-32000);
      child.stdin!.write(jsonLine({ jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 20 } }));
      const cancellation = await reader(); expect(cancellation.id).toBe(20); expect(cancellation.error.code).toBe(-32800);
    } finally { child.stdin!.end(); child.kill('SIGTERM'); }
  });

  test('R11 CSV output keeps dangerous values textual at the serialization boundary', () => {
    for (const value of ['=1+1', '+SUM(A1:A2)', '-10+20', '@cmd', '  =1+1', '\t=1+1', '\r=1+1']) expect(spreadsheetSafeCsvCell(value)).toMatch(/^"'/);
  });
});

function apiDoc(parameter: any, schema: any): OpenApiDocument { return { openapi: '3.1.0', paths: { '/x': { post: { parameters: [parameter], requestBody: { content: { 'application/json': { schema } } }, responses: { '200': { content: { 'application/json': { schema: { type: 'object' } } } } } } } } }; }
function makeDirLink(target: string, link: string): void { fs.symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir'); }
function jsonLine(value: unknown): string { return `${JSON.stringify(value)}\n`; }
function jsonLineReader(stream: NodeJS.ReadableStream): () => Promise<any> {
  let buffer = ''; const queue: any[] = []; const waiters: Array<(value: any) => void> = [];
  stream.on('data', chunk => { buffer += String(chunk); for (;;) { const index = buffer.indexOf('\n'); if (index < 0) break; const line = buffer.slice(0, index).trim(); buffer = buffer.slice(index + 1); if (!line) continue; const parsed = JSON.parse(line); const waiter = waiters.shift(); if (waiter) waiter(parsed); else queue.push(parsed); } });
  return () => queue.length ? Promise.resolve(queue.shift()) : new Promise(resolve => waiters.push(resolve));
}
