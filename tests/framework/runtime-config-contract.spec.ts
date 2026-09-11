import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { RuntimeConfig } from '../../src/framework/core/config/runtime.config';
import { WorkspaceContext } from '../../src/framework/core/config/workspace.context';
import { optionalDatabaseSkipReason, requiresDatabaseCapability } from '../../src/framework/core/config/capability.policy';

function createRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-runtime-contract-'));
  fs.mkdirSync(path.join(root, 'config'), { recursive: true });
  fs.writeFileSync(path.join(root, 'config', 'organization.json'), JSON.stringify({
    execution: { workers: '50%', retries: 0 },
    playwright: {
      browsers: ['chromium'],
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      video: 'retain-on-failure',
      visualMaxDiffPixelRatio: 0.01,
      ignoreHTTPSErrors: false,
      wsConnectTimeoutMs: 30000,
    },
  }));
  for (const project of ['alpha', 'beta']) {
    fs.mkdirSync(path.join(root, 'projects', project, 'config'), { recursive: true });
    fs.writeFileSync(path.join(root, 'projects', project, 'project.json'), JSON.stringify({ capabilities: { database: { required: false } } }));
    fs.writeFileSync(path.join(root, 'projects', project, 'config', 'qa.json'), JSON.stringify({
      environment: 'qa',
      application: {
        name: project,
        uiBaseUrl: `https://${project}.example.test`,
        apiBaseUrl: `https://api.${project}.example.test`,
      },
      auth: { strategy: 'none' },
      capabilities: { database: { type: 'none' } },
    }));
  }
  return root;
}

test.describe('runtime configuration contract @framework', () => {
  test('fails safely when no project is selected', () => {
    const root = createRoot();
    try {
      expect(() => WorkspaceContext.resolve({ root, env: {} })).toThrow(/No project selected/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('workspace selection is used locally but explicit CI selection wins', () => {
    const root = createRoot();
    try {
      WorkspaceContext.write('alpha', 'qa', root);
      expect(WorkspaceContext.resolve({ root, env: {} })).toMatchObject({ application: 'alpha', environment: 'qa' });
      expect(WorkspaceContext.resolve({ root, env: { APP: 'beta', ENV: 'qa' } })).toMatchObject({ application: 'beta', environment: 'qa' });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('resolves layered Playwright policy and explicit environment overrides', () => {
    const root = createRoot();
    try {
      const runtime = RuntimeConfig.resolve(root, { APP: 'alpha', ENV: 'qa', PW_BROWSERS: 'webkit', PW_TRACE: 'off' });
      expect(runtime.applicationName).toBe('alpha');
      expect(runtime.environment).toBe('qa');
      expect(runtime.playwright.browsers).toEqual(['webkit']);
      expect(runtime.playwright.trace).toBe('off');
      expect(runtime.application.uiBaseUrl).toBe('https://alpha.example.test');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('database capability policy gates only explicitly tagged DB scenarios', () => {
    expect(requiresDatabaseCapability(['spec.ts', 'database connection works @db'])).toBe(true);
    expect(requiresDatabaseCapability(['spec.ts', 'normal UI flow'], ['@database'])).toBe(true);
    expect(requiresDatabaseCapability(['spec.ts', 'normal UI flow'])).toBe(false);
    expect(optionalDatabaseSkipReason({ type: 'none', required: false, enabled: false, missingConfiguration: [] })).toContain('optional and disabled');
    expect(optionalDatabaseSkipReason({ type: 'postgres', required: true, enabled: false, missingConfiguration: ['DB_HOST'] })).toBeUndefined();
    expect(optionalDatabaseSkipReason({ type: 'postgres', required: false, enabled: true, missingConfiguration: [] })).toBeUndefined();
  });

  test('resolves optional database capability without leaking DB checks into project tests', () => {
    const root = createRoot();
    try {
      const disabled = RuntimeConfig.resolve(root, { APP: 'alpha', ENV: 'qa' });
      expect(disabled.capabilities.database).toMatchObject({ type: 'none', required: false, enabled: false });

      const incomplete = RuntimeConfig.resolve(root, { APP: 'alpha', ENV: 'qa', DB_TYPE: 'postgres' });
      expect(incomplete.capabilities.database.enabled).toBe(false);
      expect(incomplete.capabilities.database.missingConfiguration).toEqual(['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']);

      const ready = RuntimeConfig.resolve(root, {
        APP: 'alpha', ENV: 'qa', DB_TYPE: 'postgres',
        DB_HOST: 'localhost', DB_NAME: 'test', DB_USER: 'user', DB_PASSWORD: 'secret',
      });
      expect(ready.capabilities.database).toMatchObject({ type: 'postgres', required: false, enabled: true, missingConfiguration: [] });
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

});
