import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { AuthManager } from '../../src/framework/core/auth.manager';
import { inferConfiguredAuthExpiry, readAuthStateMetadata, resolveAuthStatePaths, writeAuthStateMetadata, writeBrowserStorageState } from '../../src/framework/core/auth.state';
import { RuntimeConfig, type ResolvedRuntimeConfig } from '../../src/framework/core/config/runtime.config';

test.describe('generic auth lifecycle', () => {
  test('pre-run preparation refreshes missing auth once and verifies before promotion', async () => {
    const fixture = await createAuthFixture();
    try {
      const manager = new AuthManager(fixture.runtime);
      const result = await manager.prepareForRun();

      expect(result.ready).toBe(true);
      expect(result.refreshed).toBe(true);
      expect(result.verified).toBe(true);
      expect(readCounter(fixture.counterFile)).toBe(1);

      const paths = resolveAuthStatePaths(fixture.runtime.auth);
      expect(paths.storageStatePath && fs.existsSync(paths.storageStatePath)).toBe(true);
      expect(readAuthStateMetadata(paths.metadataPath)?.providerId).toBe('contract-provider');
    } finally {
      await fixture.close();
    }
  });

  test('parallel refresh callers use a single provider refresh on one runner', async () => {
    const fixture = await createAuthFixture({ providerDelayMs: 180 });
    try {
      const first = new AuthManager(fixture.runtime);
      const second = new AuthManager(fixture.runtime);
      const results = await Promise.all([first.refresh('pre-run'), second.refresh('pre-run')]);

      expect(readCounter(fixture.counterFile)).toBe(1);
      expect(results.filter(result => result.refreshed)).toHaveLength(1);
      expect(results.filter(result => result.reusedConcurrentRefresh)).toHaveLength(1);
    } finally {
      await fixture.close();
    }
  });

  test('runtime recovery hot-applies verified auth and replays navigation only', async ({ page }) => {
    const fixture = await createAuthFixture();
    try {
      await page.goto(fixture.origin);
      expect(await page.evaluate(() => localStorage.getItem('contract_token'))).toBeNull();

      const manager = new AuthManager(fixture.runtime);
      await manager.ensureAuthenticatedNavigation(page, fixture.origin);

      expect(await page.evaluate(() => localStorage.getItem('contract_token'))).toBe('contract-token');
      expect(readCounter(fixture.counterFile)).toBe(1);
    } finally {
      await fixture.close();
    }
  });

  test('near-expiry auth refreshes before a mutating action without replaying the action', async ({ page }) => {
    const fixture = await createAuthFixture();
    try {
      const paths = resolveAuthStatePaths(fixture.runtime.auth);
      if (!paths.storageStatePath || !paths.metadataPath) throw new Error('Auth fixture paths missing.');
      writeBrowserStorageState(paths.storageStatePath, {
        cookies: [],
        origins: [{ origin: fixture.origin, localStorage: [{ name: 'contract_token', value: 'old-token' }] }],
      });
      const now = new Date();
      writeAuthStateMetadata(paths.metadataPath, {
        version: 1,
        application: fixture.runtime.applicationName,
        environment: fixture.runtime.environment,
        refreshedAt: now.toISOString(),
        verifiedAt: now.toISOString(),
        expiresAt: new Date(Date.now() + 1_000).toISOString(),
        providerId: 'old-provider',
      });

      await page.goto(fixture.origin);
      await page.evaluate(() => localStorage.setItem('contract_token', 'old-token'));
      const manager = new AuthManager(fixture.runtime);
      await manager.ensureFreshBeforeAction(page);

      expect(await page.evaluate(() => localStorage.getItem('contract_token'))).toBe('contract-token');
      expect(readCounter(fixture.counterFile)).toBe(1);
    } finally {
      await fixture.close();
    }
  });

  test('known JWT expiry is a planning hint, not a file-age heuristic', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-auth-expiry-'));
    try {
      const storage = path.join(directory, 'state.json');
      const expiresSeconds = Math.floor(Date.now() / 1000) + 600;
      const token = unsignedJwt({ exp: expiresSeconds });
      writeBrowserStorageState(storage, {
        cookies: [],
        origins: [{ origin: 'https://example.test', localStorage: [{ name: 'access_token', value: token }] }],
      });

      const expiry = inferConfiguredAuthExpiry(
        { storageStatePath: storage, sessionStoragePath: `${storage}.session.json` },
        { stateKey: { name: 'access_token', storage: 'local' } },
      );
      expect(expiry?.getTime()).toBe(expiresSeconds * 1000);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});

interface AuthFixture {
  origin: string;
  runtime: ResolvedRuntimeConfig;
  counterFile: string;
  close(): Promise<void>;
}

async function createAuthFixture(options: { providerDelayMs?: number } = {}): Promise<AuthFixture> {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-auth-lifecycle-'));
  const counterFile = path.join(directory, 'refresh-count.txt');
  const providerFile = path.join(directory, 'auth.provider.mjs');
  const stateFile = path.join(directory, 'state.json');
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><html><body><main>Auth contract fixture</main></body></html>');
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Unable to allocate auth contract test server.');
  const origin = `http://127.0.0.1:${address.port}`;

  fs.writeFileSync(providerFile, providerSource(counterFile, options.providerDelayMs ?? 0));
  const baseline = RuntimeConfig.resolve(process.cwd(), { ...process.env, APP: 'demo', ENV: 'qa', PW_STORAGE_STATE: '' });
  const runtime: ResolvedRuntimeConfig = {
    ...baseline,
    applicationName: 'auth-contract',
    environment: 'qa',
    application: { name: 'Auth Contract', uiBaseUrl: origin, apiBaseUrl: origin },
    auth: {
      strategy: 'storageState',
      storageStatePath: stateFile,
      required: true,
      verification: {
        stateKey: { name: 'contract_token', storage: 'local' },
        settleMs: 0,
        timeoutMs: 1_000,
      },
      lifecycle: {
        autoRefresh: true,
        providerModule: providerFile,
        verifyBeforeRun: true,
        refreshSkewMs: 60_000,
        maxRefreshAttempts: 1,
        runtimeRecovery: 'navigation',
        maxRuntimeRefreshes: 1,
        lockTimeoutMs: 5_000,
        lockStaleMs: 5_000,
      },
    },
  };

  return {
    origin,
    runtime,
    counterFile,
    async close() {
      await new Promise<void>(resolve => server.close(() => resolve()));
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}

function providerSource(counterFile: string, delayMs: number): string {
  return `
import fs from 'node:fs';
export const authProvider = {
  id: 'contract-provider',
  async refresh(context) {
    fs.appendFileSync(${JSON.stringify(counterFile)}, '1\\n');
    if (${delayMs} > 0) await new Promise(resolve => setTimeout(resolve, ${delayMs}));
    return {
      storageState: {
        cookies: [],
        origins: [{
          origin: new URL(context.baseUrl).origin,
          localStorage: [{ name: 'contract_token', value: 'contract-token' }],
        }],
      },
      expiresAt: Date.now() + 10 * 60_000,
    };
  },
};
`;
}

function readCounter(file: string): number {
  if (!fs.existsSync(file)) return 0;
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).length;
}

function unsignedJwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.`;
}
