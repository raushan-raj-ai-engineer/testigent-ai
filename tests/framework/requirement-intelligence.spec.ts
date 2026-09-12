/** Requirement intelligence regression coverage. Author: Raushan Raj */
import { test, expect } from '@playwright/test';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readMarkdownRequirement } from '../../src/framework/intelligence/adapters/file.adapters.js';
import { analyzeRequirement } from '../../src/framework/intelligence/knowledge/analyzer.js';
import { discoverReusable } from '../../src/framework/intelligence/knowledge/framework.discovery.js';
import { resolveApplicationTarget } from '../../src/framework/intelligence/knowledge/application.resolver.js';
import { buildTestPlan } from '../../src/framework/intelligence/generation/test-plan.js';
import { generateFrameworkProposal } from '../../src/framework/intelligence/generation/framework.generator.js';

async function createFrameworkSkeleton(root: string): Promise<void> {
  await Promise.all([
    mkdir(join(root, 'projects', 'demo', 'src', 'pages'), { recursive: true }),
    mkdir(join(root, 'projects', 'demo', 'src', 'workflows'), { recursive: true }),
    mkdir(join(root, 'projects', 'crm', 'src', 'pages'), { recursive: true }),
    mkdir(join(root, 'projects', 'crm', 'src', 'workflows'), { recursive: true }),
    mkdir(join(root, 'projects', 'billing', 'src', 'pages'), { recursive: true }),
    mkdir(join(root, 'projects', 'billing', 'src', 'workflows'), { recursive: true }),
    mkdir(join(root, 'projects', 'demo', 'src', 'api'), { recursive: true }),
    mkdir(join(root, 'projects', 'demo', 'src', 'database'), { recursive: true }),
    mkdir(join(root, 'src', 'framework', 'reporting'), { recursive: true }),
    mkdir(join(root, 'src', 'framework', 'intelligence', 'knowledge'), { recursive: true }),
    mkdir(join(root, 'src', 'framework', 'data', 'schemas'), { recursive: true }),
    mkdir(join(root, 'projects', 'billing', 'tests', 'e2e'), { recursive: true }),
    mkdir(join(root, 'config'), { recursive: true })
  ]);

  await Promise.all([
    mkdir(join(root, 'src', 'framework', 'core', 'fixtures'), { recursive: true }),
    mkdir(join(root, 'src', 'framework', 'core', 'ui'), { recursive: true }),
    mkdir(join(root, 'src', 'framework', 'healing'), { recursive: true }),
    mkdir(join(root, 'src', 'framework', 'ai'), { recursive: true }),
    mkdir(join(root, 'src', 'framework', 'api'), { recursive: true }),
    mkdir(join(root, 'src', 'framework', 'database'), { recursive: true })
  ]);
  await writeFile(join(root, 'src', 'framework', 'core', 'fixtures', 'enterprise.fixture.ts'), 'export const test = {};');
  await writeFile(join(root, 'src', 'framework', 'core', 'ui', 'base.page.ts'), 'export class BasePage {}');
  await writeFile(join(root, 'src', 'framework', 'healing', 'healing.orchestrator.ts'), 'export class HealingOrchestrator {}');
  await writeFile(join(root, 'src', 'framework', 'healing', 'healing.types.ts'), 'export type LocatorPlan = unknown;');
  await writeFile(join(root, 'src', 'framework', 'ai', 'ai-provider.factory.ts'), 'export const createAiGateway = () => ({});');
  await writeFile(join(root, 'src', 'framework', 'api', 'base-api.client.ts'), 'export class BaseApiClient {}');
  await writeFile(join(root, 'src', 'framework', 'database', 'database.client.ts'), 'export interface DatabaseClient {}');
  for (const [project, application] of Object.entries({
    demo: { name: 'Demo', uiBaseUrl: 'https://demo.example.com', apiBaseUrl: 'https://demo-api.example.com' },
    crm: { name: 'CRM', uiBaseUrl: 'https://qa-crm.example.com', apiBaseUrl: 'https://qa-crm-api.example.com' },
    billing: { name: 'Billing', uiBaseUrl: 'https://qa-billing.example.com', apiBaseUrl: 'https://qa-billing-api.example.com' }
  })) {
    await mkdir(join(root, 'projects', project, 'config'), { recursive: true });
    await writeFile(join(root, 'projects', project, 'config', 'qa.json'), JSON.stringify({ environment: 'qa', application }, null, 2));
    await initializeProjectFixture(root, project);
  }
}

async function initializeProjectFixture(root: string, project: string): Promise<void> {
  const fixtureDir = join(root, 'projects', project, 'fixtures');
  await mkdir(fixtureDir, { recursive: true });
  await writeFile(join(fixtureDir, 'test.fixture.ts'), "export const test = {};\n");
}

async function writePaymentRequirement(root: string, extraTags = ''): Promise<string> {
  const source = join(root, 'payment.md');
  await writeFile(source, [
    '# Saved Card Payment', '', '## Feature', 'Payment', '', '## Priority', 'Critical', '',
    '## Description', 'Customer should be able to complete checkout using a previously saved payment card.', '',
    '## Preconditions', '- Customer is logged in', '- Customer has at least one saved card', '',
    '## Acceptance Criteria', '- Customer can select a saved card during checkout', '- Successful payment API returns 201', '- Order status becomes PAID', '- Payment record is stored in database', '- Declined payment displays an error message', '',
    '## Test Steps', '1. Login as an existing customer', '2. Search for an available product', '3. Add the product to cart', '4. Open checkout', '5. Select a saved card', '6. Submit payment', '',
    '## Expected Results', '- Payment API returns 201', '- Order status is PAID', '- Payment record exists in database', '',
    '## Tags', `@critical @payment @ui @api @db ${extraTags}`.trim()
  ].join('\n'));
  return source;
}

function saveEnv(names: string[]): () => void {
  const previous = new Map(names.map(name => [name, process.env[name]]));
  return () => { for (const [name, value] of previous) value === undefined ? delete process.env[name] : process.env[name] = value; };
}

test('manual journey is not exploded into tests and semantic assertions are de-duplicated', async () => {
  const root = await mkdtemp(join(tmpdir(), 'req-plan-')); await createFrameworkSkeleton(root);
  const restore = saveEnv(['APP', 'APP_BASE_URL', 'ENV']); process.env.APP = 'billing'; process.env.ENV = 'qa';
  try {
    const requirement = await readMarkdownRequirement(await writePaymentRequirement(root));
    const analysis = await analyzeRequirement(root, requirement);
    expect(analysis.suggestedScenarios).toEqual(['Saved Card Payment', 'Declined payment displays an error message']);
    expect(requirement.preconditions).toEqual(['Customer is logged in', 'Customer has at least one saved card']);
    const plan = buildTestPlan(analysis);
    expect(plan.scenarios).toHaveLength(2);
    expect(plan.scenarios[0].manualSteps).toHaveLength(6);
    expect(plan.scenarios[0].assertions).toEqual([
      'Customer can select a saved card during checkout',
      'Successful payment API returns 201',
      'Order status becomes PAID',
      'Payment record is stored in database'
    ]);
    expect(plan.scenarios[1].reviewRequired).toBe(true);
    expect(plan.targetApplication).toBe('billing');
  } finally { restore(); }
});

test('framework discovery ignores technical-layer words and keeps only meaningful automation abstractions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'req-discovery-')); await createFrameworkSkeleton(root);
  await writeFile(join(root, 'projects', 'crm', 'src', 'workflows', 'login.workflow.ts'), 'export class LoginWorkflow { async login() {} }');
  await writeFile(join(root, 'projects', 'demo', 'src', 'database', 'order.repository.ts'), 'export class OrderRepository { async findOrderStatus() {} }');
  await writeFile(join(root, 'projects', 'demo', 'src', 'api', 'user.api.ts'), 'export class UserApi { async request() { return 201; } }');
  await writeFile(join(root, 'src', 'framework', 'data', 'schemas', 'login.schema.ts'), 'export const loginSchema = {};');
  await writeFile(join(root, 'src', 'framework', 'reporting', 'business.reporter.ts'), 'payment login order status dashboard report');

  const direct = await discoverReusable(root, 'Saved card payment API database login order status');
  expect(direct.some(candidate => candidate.path.endsWith('user.api.ts'))).toBe(false);
  expect(direct.some(candidate => candidate.path.includes('src/framework/reporting/'))).toBe(false);

  const restore = saveEnv(['APP', 'ENV']); process.env.APP = 'billing'; process.env.ENV = 'qa';
  try {
    const analysis = await analyzeRequirement(root, await readMarkdownRequirement(await writePaymentRequirement(root)));
    expect(analysis.reusableCandidates.some(candidate => candidate.path.endsWith('login.schema.ts'))).toBe(false);
    expect(analysis.reusableCandidates.some(candidate => candidate.path.endsWith('order.repository.ts'))).toBe(true);
  } finally { restore(); }
});

test('application resolver maps a configured new URL and blocks conflicting stale APP values', async () => {
  const root = await mkdtemp(join(tmpdir(), 'req-app-url-')); await createFrameworkSkeleton(root);
  const requirement = await readMarkdownRequirement(await writePaymentRequirement(root));
  const restore = saveEnv(['APP', 'APP_BASE_URL', 'ENV']); process.env.ENV = 'qa';
  try {
    delete process.env.APP; process.env.APP_BASE_URL = 'https://qa-billing.example.com/checkout/payment';
    const byUrl = await resolveApplicationTarget(root, requirement, []);
    expect(byUrl.app).toBe('billing'); expect(byUrl.source).toBe('url-config');

    process.env.APP = 'crm';
    const conflict = await resolveApplicationTarget(root, requirement, []);
    expect(conflict.app).toBeUndefined(); expect(conflict.source).toBe('conflict');
    expect(conflict.reason).toMatch(/application mapping conflict/i);
    expect(conflict.reason).toContain('Align APP/@app with APP_BASE_URL');
  } finally { restore(); }
});

test('application resolver never silently defaults to demo when multiple apps are possible', async () => {
  const root = await mkdtemp(join(tmpdir(), 'req-app-ambiguous-')); await createFrameworkSkeleton(root);
  const requirement = await readMarkdownRequirement(await writePaymentRequirement(root));
  const restore = saveEnv(['APP', 'APP_BASE_URL', 'ENV']); delete process.env.APP; delete process.env.APP_BASE_URL; process.env.ENV = 'qa';
  try {
    const resolution = await resolveApplicationTarget(root, requirement, []);
    expect(resolution.app).toBeUndefined(); expect(resolution.source).toBe('unresolved');
    const analysis = await analyzeRequirement(root, requirement);
    await expect(generateFrameworkProposal(root, analysis)).rejects.toThrow('Generation blocked');
  } finally { restore(); }
});

test('explicit new APP plus an unmapped new URL generates in that application instead of demo', async () => {
  const root = await mkdtemp(join(tmpdir(), 'req-new-app-')); await createFrameworkSkeleton(root);
  const restore = saveEnv(['APP', 'APP_BASE_URL', 'ENV']); process.env.APP = 'claims'; process.env.APP_BASE_URL = 'https://qa-claims.example.net'; process.env.ENV = 'qa';
  try {
    const requirement = await readMarkdownRequirement(await writePaymentRequirement(root));
    const analysis = await analyzeRequirement(root, requirement);
    expect(analysis.applicationResolution?.app).toBe('claims'); expect(analysis.applicationResolution?.source).toBe('explicit-new-app');
    await initializeProjectFixture(root, 'claims');
    const generated = await generateFrameworkProposal(root, analysis);
    expect(generated.manifest.targetApplication).toBe('claims');
    expect(generated.manifest.created.some(item => item.path.includes('projects/claims/src/pages/payment.page.ts'))).toBe(true);
    expect(generated.manifest.created.some(item => item.path.includes('projects/demo/src/pages/payment.page.ts'))).toBe(false);
  } finally { restore(); }
});

test('feature reuse may suppress only the matching abstraction in the resolved app', async () => {
  const root = await mkdtemp(join(tmpdir(), 'req-app-affinity-')); await createFrameworkSkeleton(root);
  await writeFile(join(root, 'projects', 'crm', 'src', 'pages', 'payment.page.ts'), 'export class PaymentPage {}');
  await writeFile(join(root, 'projects', 'crm', 'src', 'workflows', 'login.workflow.ts'), 'export class LoginWorkflow {}');
  const restore = saveEnv(['APP', 'ENV']); process.env.APP = 'billing'; process.env.ENV = 'qa';
  try {
    const requirement = await readMarkdownRequirement(await writePaymentRequirement(root));
    const analysis = await analyzeRequirement(root, requirement);
    const output = await generateFrameworkProposal(root, analysis);
    expect(output.manifest.created.some(item => item.path.includes('projects/billing/src/pages/payment.page.ts'))).toBe(true);
    expect(output.manifest.reused.some(item => item.path.includes('projects/crm/'))).toBe(false);
  } finally { restore(); }
});

test('generator reruns safely and never overwrites human-owned files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'req-generator-')); await createFrameworkSkeleton(root);
  const restore = saveEnv(['APP', 'ENV']); process.env.APP = 'demo'; process.env.ENV = 'qa';
  try {
    const requirement = await readMarkdownRequirement(await writePaymentRequirement(root)); const analysis = await analyzeRequirement(root, requirement);
    const first = await generateFrameworkProposal(root, analysis); expect(first.manifest.reviewRequired).toBe(true);
    const second = await generateFrameworkProposal(root, analysis); expect(second.manifest.warnings.some(message => message.includes('Existing generated proposal kept unchanged'))).toBe(true);
    const pagePath = join(root, 'projects', 'demo', 'src', 'pages', 'payment.page.ts');
    await writeFile(pagePath, '/** Human owned. Author: Raushan Raj */\nexport class PaymentPage {}\n');
    const third = await generateFrameworkProposal(root, analysis); expect(await readFile(pagePath, 'utf8')).toContain('Human owned');
    expect(third.manifest.warnings.some(message => message.includes('Human-owned framework file already exists'))).toBe(true);
  } finally { restore(); }
});

test('generated proposal follows enterprise architecture, target-app tags and stays review blocked', async () => {
  const root = await mkdtemp(join(tmpdir(), 'req-enterprise-')); await createFrameworkSkeleton(root);
  await Promise.all([
    mkdir(join(root, 'src', 'framework', 'core', 'fixtures'), { recursive: true }), mkdir(join(root, 'src', 'framework', 'core', 'ui'), { recursive: true }),
    mkdir(join(root, 'src', 'framework', 'core', 'config'), { recursive: true }), mkdir(join(root, 'src', 'framework', 'healing'), { recursive: true }), mkdir(join(root, 'src', 'framework', 'ai'), { recursive: true }),
    mkdir(join(root, 'src', 'framework', 'api'), { recursive: true }), mkdir(join(root, 'src', 'framework', 'database'), { recursive: true })
  ]);
  await writeFile(join(root, 'src', 'framework', 'core', 'fixtures', 'enterprise.fixture.ts'), `export { test } from '@playwright/test';`);
  await writeFile(join(root, 'src', 'framework', 'core', 'ui', 'base.page.ts'), 'export class BasePage {}');
  await writeFile(join(root, 'src', 'framework', 'healing', 'healing.orchestrator.ts'), 'export class HealingOrchestrator {}');
  await writeFile(join(root, 'src', 'framework', 'ai', 'ai-provider.factory.ts'), 'export function createAiGateway() { return {}; }');
  await writeFile(join(root, 'src', 'framework', 'api', 'base-api.client.ts'), 'export class BaseApiClient {}');
  await writeFile(join(root, 'src', 'framework', 'core', 'config', 'application.registry.ts'), 'export class ApplicationRegistry {}');
  await writeFile(join(root, 'src', 'framework', 'database', 'database.client.ts'), 'export interface DatabaseClient {}');
  const restore = saveEnv(['APP', 'ENV']); process.env.APP = 'billing'; process.env.ENV = 'qa';
  try {
    const analysis = await analyzeRequirement(root, await readMarkdownRequirement(await writePaymentRequirement(root)));
    const output = await generateFrameworkProposal(root, analysis);
    const generatedTestPath = join(root, output.manifest.created.find(item => item.kind === 'test')!.path);
    const generatedTest = await readFile(generatedTestPath, 'utf8');
    const generatedPage = await readFile(join(root, 'projects', 'billing', 'src', 'pages', 'payment.page.ts'), 'utf8');
    expect(generatedTest).toContain('../../fixtures/test.fixture.js'); expect(generatedTest).toContain('@app:billing'); expect(generatedTest).toContain('test.fixme'); expect(generatedTest).toContain('test.step(');
    expect(generatedPage).toContain('extends BasePage');
  } finally { restore(); }
});
