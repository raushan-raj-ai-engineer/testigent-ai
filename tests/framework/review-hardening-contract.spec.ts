import { expect, test } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { BaseApiClient } from '../../src/framework/api/base-api.client';
import { AiGateway } from '../../src/framework/ai/ai.gateway';
import { assertAiDestinationAllowed } from '../../src/framework/ai/ai-egress.policy';
import { HttpAiProvider } from '../../src/framework/ai/http-ai.provider';
import { fetchWithTimeout } from '../../src/framework/ai/ai-provider.utils';
import type { AiHealingRequest, AiProvider } from '../../src/framework/ai/ai.types';
import { RuntimeConfig } from '../../src/framework/core/config/runtime.config';
import { ProjectPaths } from '../../src/framework/core/config/project.paths';
import { RunContext } from '../../src/framework/core/config/run.context';
import { ReportHistoryStore } from '../../src/framework/reporting/report-history.store';
import { HealingCache } from '../../src/framework/healing/healing.cache';
import type { LocatorPlan } from '../../src/framework/healing/healing.types';
import { redact, sanitizeText, sanitizeUrl } from '../../src/framework/logging/redactor';
import { evaluateSecurityAudit, type SecurityExceptionFile } from '../../src/framework/security/advisory.policy';
import {
  buildBulkAdvisoryPayload,
  normalizeBulkAdvisoryResponse,
} from '../../src/framework/security/npm-bulk-audit';

const envKeys = [
  'AI_ENABLED', 'HEALING_AI_ENABLED', 'AI_AUDIT_ENABLED', 'AI_RUNTIME_LOGGING', 'AI_ENDPOINT', 'AI_MODEL',
  'AI_ALLOW_CLOUD_EGRESS', 'AI_ALLOWED_EXTERNAL_ORIGINS', 'AI_ALLOWED_PRIVATE_ORIGINS', 'AI_ALLOW_CROSS_ORIGIN_REDIRECTS', 'AI_TIMEOUT_MS',
  'APP', 'ENV', 'RUN_ID', 'HEALING_CACHE_TTL_MS', 'REPORT_HISTORY_FILE'
] as const;

test.describe('Architect review hardening contracts', () => {
  test('A1 removes canary secrets from JSON, URL, free text and mocked outbound AI payloads', async () => {
    const jsonCanary = 'CANARY_JSON_91af';
    const queryCanary = 'CANARY_QUERY_73bc';
    const textCanary = 'CANARY_TEXT_44dd';
    const snapshotCanary = 'CANARY_SNAPSHOT_8ee1';
    const providerOutputCanary = 'CANARY_PROVIDER_OUTPUT_771c';

    expect(JSON.stringify(redact({ responseBody: JSON.stringify({ token: jsonCanary, nested: { password: 'pw' } }) }))).not.toContain(jsonCanary);
    expect(sanitizeUrl(`https://example.test/orders?token=${queryCanary}&page=2`)).not.toContain(queryCanary);
    const piiUrl = sanitizeUrl('https://example.test/orders?note=owner%3Dtest%40example.com&next=/users/test@example.com');
    expect(piiUrl).not.toContain('test@example.com');
    expect(piiUrl).not.toContain('test%40example.com');
    expect(sanitizeText(`authorization=${textCanary} Bearer eyJabc.def.ghi user=test@example.com`)).not.toContain(textCanary);
    expect(sanitizeText(`button "Approve" token=${snapshotCanary}`)).not.toContain(snapshotCanary);

    let captured: AiHealingRequest | undefined;
    const provider: AiProvider = {
      async proposeLocator(request) {
        captured = request;
        return { descriptor: { type: 'role', role: 'button', name: 'Approve' }, confidence: 0.99, reason: `token=${providerOutputCanary}` };
      }
    };
    const restore = saveEnv(envKeys);
    try {
      process.env.AI_ENABLED = 'true';
      process.env.HEALING_AI_ENABLED = 'true';
      process.env.AI_AUDIT_ENABLED = 'false';
      process.env.AI_RUNTIME_LOGGING = 'false';
      const gateway = new AiGateway(provider, 'redaction-contract');
      const result = await gateway.proposeLocator({
        planId: 'review.a1',
        businessName: `Approve token=${textCanary}`,
        accessibilitySnapshot: `- button "Approve"\n- text "token=${snapshotCanary}"`,
        allowedDescriptorTypes: ['role']
      });
      expect(JSON.stringify(captured)).not.toContain(textCanary);
      expect(JSON.stringify(captured)).not.toContain(snapshotCanary);
      expect(JSON.stringify(result)).not.toContain(providerOutputCanary);
    } finally { restore(); }
  });

  test('A1 API evidence sanitizes serialized response bodies before persistence', async ({ request }) => {
    const canary = 'CANARY_API_BODY_b711';
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, token: canary, nested: { password: 'secret' } }));
    });
    const base = await listen(server);
    let evidence: unknown;
    const logger = { info: (_event: string, data: unknown) => { evidence = data; } };
    try {
      const client = new BaseApiClient(request, base, logger);
      await client.get('/probe?api_key=CANARY_URL_KEY');
      const serialized = JSON.stringify(evidence);
      expect(serialized).not.toContain(canary);
      expect(serialized).not.toContain('CANARY_URL_KEY');
    } finally { await close(server); }
  });

  test('A2 resolves egress from destination origin and rejects redirects before external network activity', async () => {
    expect(() => assertAiDestinationAllowed('https://example.invalid/ai', { AI_ALLOW_CLOUD_EGRESS: 'false' } as NodeJS.ProcessEnv)).toThrow(/AI_EGRESS_BLOCKED/);
    expect(() => assertAiDestinationAllowed('https://example.invalid/ai', { AI_ALLOW_CLOUD_EGRESS: 'true' } as NodeJS.ProcessEnv)).toThrow(/not approved/);
    expect(assertAiDestinationAllowed('https://example.invalid/ai', {
      AI_ALLOW_CLOUD_EGRESS: 'true', AI_ALLOWED_EXTERNAL_ORIGINS: 'https://example.invalid'
    } as NodeJS.ProcessEnv).origin).toBe('https://example.invalid');
    expect(() => assertAiDestinationAllowed('http://example.invalid/ai', {
      AI_ALLOW_CLOUD_EGRESS: 'true', AI_ALLOWED_EXTERNAL_ORIGINS: 'http://example.invalid'
    } as NodeJS.ProcessEnv)).toThrow(/must use HTTPS/);

    const server = http.createServer((_req, res) => { res.writeHead(302, { location: 'https://example.invalid/blocked' }); res.end(); });
    const base = await listen(server);
    const restore = saveEnv(envKeys);
    try {
      process.env.AI_ALLOW_CLOUD_EGRESS = 'false';
      await expect(fetchWithTimeout(`${base}/redirect`, { method: 'GET' }, 1_000)).rejects.toThrow(/AI_EGRESS_BLOCKED/);
    } finally { restore(); await close(server); }

    const targetServer = http.createServer((_req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); });
    const targetBase = await listen(targetServer);
    const sourceServer = http.createServer((_req, res) => { res.writeHead(302, { location: `${targetBase}/target` }); res.end(); });
    const sourceBase = await listen(sourceServer);
    const restoreCross = saveEnv(envKeys);
    try {
      process.env.AI_ALLOW_CROSS_ORIGIN_REDIRECTS = 'false';
      await expect(fetchWithTimeout(`${sourceBase}/start`, { method: 'POST', headers: { authorization: 'Bearer CANARY_REDIRECT_SECRET' }, body: '{}' }, 1_000))
        .rejects.toThrow(/AI_EGRESS_REDIRECT_BLOCKED/);
    } finally { restoreCross(); await close(sourceServer); await close(targetServer); }

    let redirectedAuthorization: string | undefined;
    const credentialTarget = http.createServer((req, res) => {
      redirectedAuthorization = req.headers.authorization;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{}');
    });
    const credentialTargetBase = await listen(credentialTarget);
    const credentialSource = http.createServer((_req, res) => { res.writeHead(307, { location: `${credentialTargetBase}/target` }); res.end(); });
    const credentialSourceBase = await listen(credentialSource);
    const restoreAllowedCross = saveEnv(envKeys);
    try {
      process.env.AI_ALLOW_CROSS_ORIGIN_REDIRECTS = 'true';
      const response = await fetchWithTimeout(`${credentialSourceBase}/start`, { method: 'POST', headers: { authorization: 'Bearer CANARY_REDIRECT_SECRET', 'content-type': 'application/json' }, body: '{}' }, 1_000);
      expect(response.ok).toBe(true);
      expect(redirectedAuthorization).toBeUndefined();
    } finally { restoreAllowedCross(); await close(credentialSource); await close(credentialTarget); }
  });

  test('A4 runtime paths are isolated by application, environment and immutable run id', () => {
    const qa = RuntimeConfig.resolve(process.cwd(), { ...process.env, APP: 'demo', ENV: 'qa', RUN_ID: 'review-qa-run' });
    const uat = RuntimeConfig.resolve(process.cwd(), { ...process.env, APP: 'demo', ENV: 'uat', RUN_ID: 'review-uat-run' });
    expect(qa.reportRoot).toContain(path.join('reports', 'demo', 'qa', 'review-qa-run'));
    expect(uat.reportRoot).toContain(path.join('reports', 'demo', 'uat', 'review-uat-run'));
    expect(qa.reportRoot).not.toBe(uat.reportRoot);
    expect(qa.resultRoot).not.toBe(uat.resultRoot);

    const qaParallel = RuntimeConfig.resolve(process.cwd(), { ...process.env, APP: 'demo', ENV: 'qa', RUN_ID: 'review-qa-parallel' });
    expect(qaParallel.reportRoot).not.toBe(qa.reportRoot);
    expect(qaParallel.resultRoot).not.toBe(qa.resultRoot);
  });

  test('A4 mutable latest-run pointer is convenience-only and never becomes an implicit write identity', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-latest-pointer-'));
    const restore = saveEnv(envKeys);
    try {
      process.env.APP = 'demo';
      process.env.ENV = 'qa';
      delete process.env.RUN_ID;
      const pointer = RunContext.latestFile('demo', 'qa', root);
      fs.mkdirSync(path.dirname(pointer), { recursive: true });
      fs.writeFileSync(pointer, JSON.stringify({ runId: 'old-run', application: 'demo', environment: 'qa' }), 'utf8');

      expect(ProjectPaths.reports('demo', 'qa')).toBe(path.resolve('reports', 'demo', 'qa'));
      // Explicit user-facing lookup may consult latest, but generic write paths may not.
      expect(RunContext.latest('demo', 'qa', root)?.runId).toBe('old-run');

      // When a process already owns a run identity, even explicit latest helpers must prefer it
      // over a mutable pointer that another concurrent execution can update.
      process.env.RUN_ID = 'current-run';
      expect(ProjectPaths.latestReports('demo', 'qa')).toBe(path.resolve('reports', 'demo', 'qa', 'current-run'));
    } finally { restore(); fs.rmSync(root, { recursive: true, force: true }); }
  });

  test('A4 report-history override remains supported after environment scoping', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-history-override-'));
    const override = path.join(root, 'custom-history.json');
    fs.writeFileSync(override, '[]', 'utf8');
    const restore = saveEnv(envKeys);
    try {
      process.env.REPORT_HISTORY_FILE = override;
      const history = new ReportHistoryStore();
      expect(history.read()).toEqual([]);
      expect(fs.existsSync(override)).toBe(true);
    } finally { restore(); fs.rmSync(root, { recursive: true, force: true }); }
  });

  test('A5 concurrent healing cache writers preserve entries and stale plan revisions are rejected', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-cache-contract-'));
    const cacheFile = path.join(root, 'locator-cache.json');
    try {
      await Promise.all([
        runNodeHelper('tests/helpers/healing-cache-writer.ts', [cacheFile, 'plan-a', 'Button A']),
        runNodeHelper('tests/helpers/healing-cache-writer.ts', [cacheFile, 'plan-b', 'Button B'])
      ]);
      const document = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as { records: Record<string, unknown> };
      expect(Object.keys(document.records).sort()).toEqual(['plan-a', 'plan-b']);

      const restore = saveEnv(envKeys);
      try {
        process.env.APP = 'demo'; process.env.ENV = 'qa'; process.env.HEALING_CACHE_TTL_MS = '60000';
        const cache = new HealingCache(cacheFile);
        const plan: LocatorPlan = { id: 'revision', businessName: 'Save', primary: { type: 'role', role: 'button', name: 'Save' } };
        cache.set(plan, { descriptor: { type: 'role', role: 'button', name: 'Save now' }, source: 'ai', confidence: 0.99, reason: 'contract' }, 'saved');
        expect(cache.get(plan)).toBeDefined();
        const changed: LocatorPlan = { ...plan, primary: { type: 'role', role: 'button', name: 'Submit' } };
        expect(cache.get(changed)).toBeUndefined();
      } finally { restore(); }
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test('A7 generic HTTP provider has bounded timeout and schema-validates successful responses', async () => {
    const restore = saveEnv(envKeys);
    const malformed = http.createServer((_req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ descriptor: 'wrong' })); });
    const malformedBase = await listen(malformed);
    try {
      process.env.AI_ENDPOINT = malformedBase;
      process.env.AI_MODEL = 'contract-model';
      process.env.AI_TIMEOUT_MS = '500';
      const provider = new HttpAiProvider();
      await expect(provider.proposeLocator({ planId: 'a7', businessName: 'Save', accessibilitySnapshot: '- button "Save"', allowedDescriptorTypes: ['role'] })).rejects.toMatchObject({ kind: 'invalid-response', attempts: 1 });
    } finally { await close(malformed); restore(); }

    const restoreTimeout = saveEnv(envKeys);
    const stalled = http.createServer((_req, res) => { setTimeout(() => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); }, 500); });
    const stalledBase = await listen(stalled);
    try {
      process.env.AI_ENDPOINT = stalledBase;
      process.env.AI_MODEL = 'contract-model';
      process.env.AI_TIMEOUT_MS = '50';
      const provider = new HttpAiProvider();
      await expect(provider.summarizeFailures({ failure: true })).rejects.toMatchObject({ kind: 'timeout', attempts: 1 });
    } finally { await close(stalled); restoreTimeout(); }
  });

  test('A7 invalid timeout configuration fails closed before provider execution', () => {
    const restore = saveEnv(envKeys);
    try {
      process.env.AI_ENDPOINT = 'http://127.0.0.1:11434';
      process.env.AI_MODEL = 'contract-model';
      process.env.AI_TIMEOUT_MS = 'not-a-number';
      expect(() => new HttpAiProvider()).toThrow(/AI_TIMEOUT_MS must be a positive integer/);
    } finally { restore(); }
  });

  test('A8 a new advisory for the same package/range is blocked unless that exact advisory is approved', () => {
    const audit = { vulnerabilities: { xlsx: { severity: 'high', range: '<=0.20.3', via: [
      { source: 111, severity: 'high', range: '<=0.20.3', title: 'old advisory' },
      { source: 222, severity: 'high', range: '<=0.20.3', title: 'new advisory' }
    ] } } };
    const policy: SecurityExceptionFile = { schemaVersion: 1, exceptions: [{
      package: 'xlsx', advisoryId: '111', affectedRange: '<=0.20.3', rationale: 'temporary reviewed exception', owner: 'security-owner', expiresAt: '2099-01-01T00:00:00.000Z'
    }] };
    const result = evaluateSecurityAudit(audit, policy, new Date('2026-09-13T00:00:00Z'));
    expect(result.allowed.map(item => item.advisoryId)).toEqual(['111']);
    expect(result.blocking.map(item => item.advisoryId)).toEqual(['222']);

    const unresolved = evaluateSecurityAudit({ vulnerabilities: {
      parent: { severity: 'critical', range: '*', via: ['missing-child'] }
    } }, { schemaVersion: 1, exceptions: [] }, new Date('2026-09-13T00:00:00Z'));
    expect(unresolved.blocking).toHaveLength(1);
    expect(unresolved.blocking[0]?.advisoryId).toBe('unresolved:parent');
  });

  test('A8 npm Bulk Advisory fallback preserves installed versions and advisory identity', () => {
    const payload = buildBulkAdvisoryPayload({
      lockfileVersion: 3,
      packages: {
        '': { name: 'testigent-ai', version: '1.8.0' },
        'node_modules/xlsx': { version: '0.20.3' },
        'node_modules/tool/node_modules/xlsx': { version: '0.18.5' },
        'node_modules/@scope/example': { version: '2.1.0' },
      },
    });

    expect(payload).toEqual({
      '@scope/example': ['2.1.0'],
      xlsx: ['0.18.5', '0.20.3'],
    });

    const audit = normalizeBulkAdvisoryResponse({
      xlsx: [{
        id: 222,
        severity: 'high',
        vulnerable_versions: '<=0.20.3',
        title: 'bulk advisory contract',
        url: 'https://github.com/advisories/GHSA-contract',
      }],
    });

    const evaluated = evaluateSecurityAudit(
      audit,
      { schemaVersion: 1, exceptions: [] },
      new Date('2026-09-13T00:00:00Z'),
    );

    expect(evaluated.blocking).toMatchObject([{
      package: 'xlsx',
      advisoryId: '222',
      severity: 'high',
      affectedRange: '<=0.20.3',
    }]);

    expect(() => normalizeBulkAdvisoryResponse({
      malformed: [{
        id: 333,
        vulnerable_versions: '*',
      }],
    })).toThrow(/severity/i);
  });

});

function saveEnv(keys: readonly string[]): () => void {
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  return () => {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  };
}

async function listen(server: http.Server): Promise<string> {
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve()); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not resolve local server address.');
  return `http://127.0.0.1:${address.port}`;
}
async function close(server: http.Server): Promise<void> { await new Promise<void>(resolve => server.close(() => resolve())); }

async function runNodeHelper(file: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', file, ...args], {
      cwd: process.cwd(),
      env: { ...process.env, APP: 'demo', ENV: 'qa' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`helper ${file} exited ${code}: ${stderr}`)));
  });
}
