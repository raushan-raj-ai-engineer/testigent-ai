import fs from 'node:fs';
import path from 'node:path';
import { test, expect } from '../../src/framework/core/fixtures/enterprise.fixture';
import { parseWorkers, requiredTagGroupsToRegExp, resolveExecutionPolicy, tagsToRegExp } from '../../src/framework/core/execution/execution.policy';
import { mergeGovernedFilters } from '../../src/framework/core/execution/execution.cli-filters';
import { DataFactory } from '../../src/framework/data/data.factory';
import { DataScope } from '../../src/framework/data/data-scope';
import { balanceByDuration } from '../../src/framework/execution/duration-balancer';
import { validateScenario } from '../../src/framework/declarative/scenario.loader';

test('V6 execution policy preserves percentage workers and safe custom governance @framework @lane:api', async () => {
  expect(parseWorkers('50%')).toBe('50%');
  const policy = resolveExecutionPolicy({
    application: 'demo', environment: 'qa', profile: 'custom',
    env: { ...process.env, PW_WORKERS: '50%', ALLOW_AI_TESTS: undefined, ALLOW_GENERATED_TESTS: undefined, ALLOW_MANUAL_TESTS: undefined },
  });
  expect(policy.workers).toBe('50%');
  expect(policy.allowAi).toBeFalsy();
  expect(policy.allowGenerated).toBeFalsy();
  expect(policy.allowManual).toBeFalsy();
});

test('V6 data cases reject duplicate IDs before execution @framework @data @lane:api', async () => {
  const temporary = path.resolve('.runtime/duplicate-cases.json');
  fs.mkdirSync(path.dirname(temporary), { recursive: true });
  fs.writeFileSync(temporary, JSON.stringify([{ caseId: 'A' }, { caseId: 'A' }]));
  const data = new DataFactory();
  expect(() => data.loadCasesSync(temporary)).toThrow(/Duplicate caseId/);
});

test('V6 data scope separates attempt identities and preserves idempotent owners @framework @data @lane:api', async () => {
  const base = { runId: 'run-1', application: 'demo', environment: 'qa', testId: 'test-1', parallelIndex: 2, caseId: 'case-1' };
  const first = new DataScope({ ...base, retry: 0 });
  const retry = new DataScope({ ...base, retry: 1 });
  expect(first.identity('customer', 'attempt')).not.toBe(retry.identity('customer', 'attempt'));
  expect(first.identity('customer', 'stable')).toBe(retry.identity('customer', 'stable'));
  expect(first.owner('customer')).toBe(retry.owner('customer'));
  expect(first.owner('customer')).not.toBe(new DataScope({ ...base, environment: 'uat', retry: 0 }).owner('customer'));
  expect(first.owner('customer')).not.toBe(new DataScope({ ...base, testId: 'test-2', retry: 0 }).owner('customer'));
});

test('profile and lane grep constraints require both groups @framework @lane:api', async () => {
  const grep = requiredTagGroupsToRegExp([['@smoke'], ['@lane:api', '@api']]);
  expect(grep?.test('chromium x.spec.ts scenario @smoke @lane:api')).toBeTruthy();
  expect(grep?.test('chromium x.spec.ts scenario @smoke @ui')).toBeFalsy();
  expect(grep?.test('chromium x.spec.ts scenario @lane:api')).toBeFalsy();
});

test('governed CLI filters cannot replace mandatory include/exclude policy @framework @lane:api', async () => {
  const args = mergeGovernedFilters(
    ['--grep', '@payments', '--grep-invert', '@slow', '--workers=2'],
    requiredTagGroupsToRegExp([['@smoke'], ['@lane:api', '@api']]),
    tagsToRegExp(['@ai', '@manual']),
  );
  const grep = new RegExp(args[args.indexOf('--grep') + 1]!);
  const invert = new RegExp(args[args.indexOf('--grep-invert') + 1]!);
  expect(grep.test('scenario @payments @smoke @lane:api')).toBeTruthy();
  expect(grep.test('scenario @payments @lane:api')).toBeFalsy();
  expect(invert.test('scenario @ai')).toBeTruthy();
  expect(invert.test('scenario @slow')).toBeTruthy();
  expect(args).toContain('--workers=2');
});

test('duration planner balances long tests first @framework @lane:api', async () => {
  const shards = balanceByDuration([
    { key: 'a', testListLine: 'a', estimatedMs: 100 },
    { key: 'b', testListLine: 'b', estimatedMs: 90 },
    { key: 'c', testListLine: 'c', estimatedMs: 20 },
    { key: 'd', testListLine: 'd', estimatedMs: 10 },
  ], 2);
  expect(shards).toHaveLength(2);
  expect(Math.max(...shards.map(item => item.estimatedMs)) - Math.min(...shards.map(item => item.estimatedMs))).toBeLessThanOrEqual(20);
  expect(() => balanceByDuration([{ key: 'bad', testListLine: 'bad', estimatedMs: Number.NaN }], 2)).toThrow(/finite non-negative/);
});

test('declarative DSL rejects arbitrary actions @framework @lane:api', async () => {
  expect(() => validateScenario({ id: 'x', title: 'x', steps: [{ action: 'shell', command: 'rm -rf /' }] })).toThrow(/not allowed/);
});
