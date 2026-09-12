import { request } from '@playwright/test';
import type { ProjectAuthProvider } from '../../../src/framework/core/auth.provider';

/**
 * Project-owned fast auth provider. The reusable framework never knows this application's login endpoint or token key.
 * The SDET Practice credentials below are public demo credentials published by the SUT repository; AUTH_USERNAME/
 * AUTH_PASSWORD override them for private/local variants.
 */
export const authProvider: ProjectAuthProvider = {
  id: 'sdet-practice-api-login',
  async refresh(context) {
    const username = optionalSecret('AUTH_USERNAME') || 'admin@test.com';
    const password = optionalSecret('AUTH_PASSWORD') || 'Admin@123';
    const client = await request.newContext({ baseURL: context.apiBaseUrl });
    try {
      const response = await client.post('/auth/login', {
        form: { username, password },
        failOnStatusCode: false,
      });
      if (!response.ok()) {
        throw new Error(`SDET Practice auth API returned HTTP ${response.status()}.`);
      }
      const body = await response.json() as { access_token?: unknown };
      if (typeof body.access_token !== 'string' || !body.access_token.trim()) {
        throw new Error('SDET Practice auth API did not return access_token.');
      }
      const token = body.access_token.trim();
      return {
        providerId: 'sdet-practice-api-login',
        expiresAt: jwtExpiryMs(token),
        storageState: {
          cookies: [],
          origins: [{
            origin: new URL(context.baseUrl).origin,
            localStorage: [{ name: 'sdet_access_token', value: token }],
          }],
        },
      };
    } finally {
      await client.dispose();
    }
  },
};

function jwtExpiryMs(token: string): number | undefined {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return undefined;
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as { exp?: unknown };
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

function optionalSecret(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value || value === `$(${name})`) return undefined;
  return value;
}
