import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { authProvider } from '../../projects/sdet-practice/auth/auth.provider';
import type { AuthProviderContext } from '../../src/framework/core/auth.provider';

test.describe('sdet-practice auth provider contract', () => {
  test('uses the live demo username casing and produces browser storage state', async () => {
    const previousUsername = process.env.AUTH_USERNAME;
    const previousPassword = process.env.AUTH_PASSWORD;
    delete process.env.AUTH_USERNAME;
    delete process.env.AUTH_PASSWORD;

    const requests: Array<{ username?: string; password?: string }> = [];
    const token = unsignedJwt({ sub: '1', role: 'ADMIN', exp: Math.floor(Date.now() / 1000) + 600 });
    const server = http.createServer((request, response) => {
      let body = '';
      request.setEncoding('utf8');
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        const form = new URLSearchParams(body);
        requests.push({ username: form.get('username') ?? undefined, password: form.get('password') ?? undefined });
        if (request.url !== '/auth/login' || form.get('username') !== 'admin@test.com' || form.get('password') !== 'Admin@123') {
          response.writeHead(401, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ detail: 'Unauthorized' }));
          return;
        }
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ access_token: token, token_type: 'bearer' }));
      });
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Unable to allocate auth provider contract server.');
    const origin = `http://127.0.0.1:${address.port}`;
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-sdet-auth-provider-'));

    try {
      const context: AuthProviderContext = {
        application: 'sdet-practice',
        environment: 'qa',
        baseUrl: origin,
        apiBaseUrl: origin,
        reason: 'pre-run',
        storageStatePath: path.join(temp, 'state.json'),
        sessionStoragePath: path.join(temp, 'session.json'),
        auth: { strategy: 'storageState', required: true },
      };

      const result = await authProvider.refresh(context);
      expect(requests).toEqual([{ username: 'admin@test.com', password: 'Admin@123' }]);
      expect(result.providerId).toBe('sdet-practice-api-login');
      expect(result.expiresAt).toBeGreaterThan(Date.now());
      expect(result.storageState).toEqual({
        cookies: [],
        origins: [{
          origin,
          localStorage: [{ name: 'sdet_access_token', value: token }],
        }],
      });
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
      fs.rmSync(temp, { recursive: true, force: true });
      if (previousUsername === undefined) delete process.env.AUTH_USERNAME;
      else process.env.AUTH_USERNAME = previousUsername;
      if (previousPassword === undefined) delete process.env.AUTH_PASSWORD;
      else process.env.AUTH_PASSWORD = previousPassword;
    }
  });
});

function unsignedJwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.`;
}
