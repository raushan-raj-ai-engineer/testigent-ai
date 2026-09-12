import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseProjectEnvironmentMap,
  readMultiProjectGroups,
  resolveMultiProjectTargets,
} from '../../src/framework/core/execution/multi-project';

function createRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-multi-project-'));
  for (const [project, environments] of Object.entries({ portal: ['qa'], payments: ['qa', 'uat'], claims: ['uat'] })) {
    for (const environment of environments) {
      const dir = path.join(root, 'projects', project, 'config');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${environment}.json`), JSON.stringify({
        environment,
        application: { uiBaseUrl: `https://${project}.example.test`, apiBaseUrl: `https://${project}.example.test/api` },
      }));
    }
  }
  fs.mkdirSync(path.join(root, 'config'), { recursive: true });
  fs.writeFileSync(path.join(root, 'config', 'project-groups.json'), JSON.stringify({
    groups: {
      'customer-a': {
        projects: ['portal', 'payments'],
        environments: { portal: 'qa', payments: 'uat' },
      },
    },
  }));
  return root;
}

test.describe('multi-project selection', () => {
  test('all dynamically discovers every registered project and supports a shared environment', () => {
    const root = createRoot();
    try {
      const targets = resolveMultiProjectTargets({ all: true, environmentMap: { portal: 'qa', payments: 'uat', claims: 'uat' } }, root);
      expect(targets).toEqual([
        { application: 'claims', environment: 'uat' },
        { application: 'payments', environment: 'uat' },
        { application: 'portal', environment: 'qa' },
      ]);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test('explicit apps preserve user order and allow mixed environments', () => {
    const root = createRoot();
    try {
      const targets = resolveMultiProjectTargets({
        apps: ['payments', 'portal'],
        environmentMap: parseProjectEnvironmentMap('payments:uat,portal:qa'),
      }, root);
      expect(targets).toEqual([
        { application: 'payments', environment: 'uat' },
        { application: 'portal', environment: 'qa' },
      ]);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test('customer groups provide reusable project portfolios with per-project environment defaults', () => {
    const root = createRoot();
    try {
      expect(readMultiProjectGroups(root)['customer-a']?.projects).toEqual(['portal', 'payments']);
      expect(resolveMultiProjectTargets({ group: 'customer-a' }, root)).toEqual([
        { application: 'portal', environment: 'qa' },
        { application: 'payments', environment: 'uat' },
      ]);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test('ambiguous environments fail closed instead of guessing', () => {
    const root = createRoot();
    try {
      expect(() => resolveMultiProjectTargets({ apps: ['payments'] }, root)).toThrow(/Environment is ambiguous/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
