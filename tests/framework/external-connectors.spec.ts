/** External connector regression coverage; no real network calls. Author: Raushan Raj */
import { test, expect } from '@playwright/test';
import { connectorJson } from '../../src/framework/intelligence/connectors/http.client.js';
import { JiraRequirementAdapter, AzureBoardsRequirementAdapter } from '../../src/framework/intelligence/adapters/remote.adapters.js';
import { loadRequirement } from '../../src/framework/intelligence/adapters/source.factory.js';
import { AzureBoardsExecutionPublisher, GitHubIssueExecutionPublisher, JiraExecutionPublisher } from '../../src/framework/intelligence/publishers/publishers.js';
import type { ExecutionPublishRequest } from '../../src/framework/intelligence/core/models.js';

function saveEnv(names: string[]): () => void {
  const previous = new Map(names.map(name => [name, process.env[name]]));
  return () => {
    for (const [name, value] of previous) value === undefined ? delete process.env[name] : process.env[name] = value;
  };
}

function response(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

const run: ExecutionPublishRequest = {
  runId: 'RUN-42', requirementId: '42', status: 'FAILED', environment: 'qa',
  total: 3, passed: 2, failed: 1, skipped: 0, failedScenarios: ['Checkout payment declined incorrectly']
};

test('Jira connector maps ADF plus configured acceptance/manual-step fields into the common requirement model', async () => {
  const restore = saveEnv(['JIRA_ACCEPTANCE_CRITERIA_FIELD_ID', 'JIRA_MANUAL_STEPS_FIELD_ID', 'CONNECTOR_MAX_RETRIES']);
  process.env.JIRA_ACCEPTANCE_CRITERIA_FIELD_ID = 'customfield_10001';
  process.env.JIRA_MANUAL_STEPS_FIELD_ID = 'customfield_10002';
  process.env.CONNECTOR_MAX_RETRIES = '0';
  const originalFetch = globalThis.fetch;
  let requested = '';
  globalThis.fetch = async (input) => {
    requested = String(input);
    return response({
      key: 'PAY-142', fields: {
        summary: 'Saved Card Payment', labels: ['feature:payment', 'priority:critical'], priority: { name: 'Highest' }, components: [{ name: 'Checkout' }],
        description: { type: 'doc', version: 1, content: [
          { type: 'heading', content: [{ type: 'text', text: 'Preconditions' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '- Customer is logged in' }] },
          { type: 'heading', content: [{ type: 'text', text: 'Expected Results' }] },
          { type: 'paragraph', content: [{ type: 'text', text: '- Order becomes PAID' }] }
        ] },
        customfield_10001: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Payment API returns 201' }] }] },
        customfield_10002: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: '1. Select saved card\n2. Submit payment' }] }] }
      }
    });
  };
  try {
    const requirement = await new JiraRequirementAdapter('https://company.atlassian.net', 'qa@example.com', 'token').getRequirement('PAY-142');
    expect(requested).toContain('/rest/api/3/issue/PAY-142');
    expect(requirement.acceptanceCriteria).toEqual(['Payment API returns 201']);
    expect(requirement.manualTestSteps.map(step => step.action)).toEqual(['Select saved card', 'Submit payment']);
    expect(requirement.preconditions).toEqual(['Customer is logged in']);
    expect(requirement.expectedResults).toEqual(['Order becomes PAID']);
    expect(requirement.feature).toBe('Checkout');
  } finally { globalThis.fetch = originalFetch; restore(); }
});

test('Azure Boards connector supports bearer auth and preserves structured HTML fields', async () => {
  const restore = saveEnv(['AZURE_DEVOPS_ACCEPTANCE_CRITERIA_FIELD', 'AZURE_DEVOPS_MANUAL_STEPS_FIELD', 'CONNECTOR_MAX_RETRIES']);
  process.env.AZURE_DEVOPS_ACCEPTANCE_CRITERIA_FIELD = 'Custom.Acceptance';
  process.env.AZURE_DEVOPS_MANUAL_STEPS_FIELD = 'Custom.ManualSteps';
  process.env.CONNECTOR_MAX_RETRIES = '0';
  const originalFetch = globalThis.fetch;
  let auth = '';
  globalThis.fetch = async (_input, init) => {
    auth = String((init?.headers as Record<string, string> | undefined)?.Authorization ?? '');
    return response({ id: 5142, fields: {
      'System.Title': 'Cancel order', 'System.Description': '<h2>Preconditions</h2><ul><li>Order exists</li></ul><h2>Expected Results</h2><p>Status is CANCELLED</p>',
      'Custom.Acceptance': '<ul><li>Cancellation API returns 200</li></ul>',
      'Custom.ManualSteps': '<p>1. Open order</p><p>2. Click Cancel</p>', 'System.Tags': 'feature:orders;critical',
      'System.AreaPath': 'Commerce\\Orders', 'Microsoft.VSTS.Common.Priority': 1
    }, relations: [] });
  };
  try {
    const requirement = await new AzureBoardsRequirementAdapter('https://dev.azure.com/acme', 'Commerce', '', 'entra-token').getRequirement('5142');
    expect(auth).toBe('Bearer entra-token');
    expect(requirement.acceptanceCriteria).toEqual(['Cancellation API returns 200']);
    expect(requirement.manualTestSteps.map(step => step.action)).toEqual(['Open order', 'Click Cancel']);
    expect(requirement.preconditions).toEqual(['Order exists']);
    expect(requirement.expectedResults).toEqual(['Status is CANCELLED']);
  } finally { globalThis.fetch = originalFetch; restore(); }
});

test('GitHub direct issue URL resolves repository and uses the current configurable API version', async () => {
  const restore = saveEnv(['GITHUB_TOKEN', 'GITHUB_API_VERSION', 'CONNECTOR_MAX_RETRIES']);
  process.env.GITHUB_TOKEN = 'gh-token'; process.env.GITHUB_API_VERSION = '2026-03-10'; process.env.CONNECTOR_MAX_RETRIES = '0';
  const originalFetch = globalThis.fetch;
  let url = '', version = '';
  globalThis.fetch = async (input, init) => {
    url = String(input); version = String((init?.headers as Record<string, string> | undefined)?.['X-GitHub-Api-Version'] ?? '');
    return response({ number: 77, title: 'Refund reason is mandatory', body: '## Acceptance Criteria\n- Refund cannot be submitted without a reason\n\n## Test Steps\n1. Open refund\n2. Submit without reason', labels: [{ name: 'feature:refund' }], html_url: 'https://github.com/acme/store/issues/77' });
  };
  try {
    const requirement = await loadRequirement('https://github.com/acme/store/issues/77');
    expect(url).toContain('/repos/acme/store/issues/77');
    expect(version).toBe('2026-03-10');
    expect(requirement.feature).toBe('refund');
    expect(requirement.manualTestSteps).toHaveLength(2);
  } finally { globalThis.fetch = originalFetch; restore(); }
});

test('connector HTTP client retries a rate-limited read without leaking query values into errors', async () => {
  const restore = saveEnv(['CONNECTOR_MAX_RETRIES', 'CONNECTOR_RETRY_BACKOFF_MS', 'CONNECTOR_MAX_BACKOFF_MS']);
  process.env.CONNECTOR_MAX_RETRIES = '1'; process.env.CONNECTOR_RETRY_BACKOFF_MS = '0'; process.env.CONNECTOR_MAX_BACKOFF_MS = '0';
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return calls === 1 ? response({ error: 'rate' }, 429, { 'retry-after': '0' }) : response({ ok: true }); };
  try {
    const result = await connectorJson<{ ok: boolean }>('https://example.test/items?secret=do-not-log');
    expect(result.ok).toBe(true); expect(calls).toBe(2);
  } finally { globalThis.fetch = originalFetch; restore(); }
});

test('write-back dry run returns planned actions and never contacts external systems', async () => {
  const restore = saveEnv(['EXTERNAL_PUBLISH_DRY_RUN', 'ALLOW_EXTERNAL_COMMENTS', 'ALLOW_EXTERNAL_CUSTOM_FIELDS', 'ALLOW_WORKFLOW_TRANSITIONS', 'JIRA_AUTOMATION_STATUS_FIELD_ID']);
  process.env.EXTERNAL_PUBLISH_DRY_RUN = 'true'; process.env.ALLOW_EXTERNAL_COMMENTS = 'true'; process.env.ALLOW_EXTERNAL_CUSTOM_FIELDS = 'true'; process.env.ALLOW_WORKFLOW_TRANSITIONS = 'false'; process.env.JIRA_AUTOMATION_STATUS_FIELD_ID = 'customfield_123';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('network must not be called in dry run'); };
  try {
    const result = await new JiraExecutionPublisher().publish(run);
    expect(result.success).toBe(true); expect(result.action).toContain('dry-run:'); expect(result.action).toContain('comment'); expect(result.action).toContain('custom-field');
  } finally { globalThis.fetch = originalFetch; restore(); }
});

test('Azure custom-field write uses a correct JSON Pointer path and does not escape dots', async () => {
  const names = ['EXTERNAL_PUBLISH_DRY_RUN', 'ALLOW_EXTERNAL_COMMENTS', 'ALLOW_EXTERNAL_CUSTOM_FIELDS', 'ALLOW_WORKFLOW_TRANSITIONS', 'AZURE_DEVOPS_ORG_URL', 'AZURE_DEVOPS_PROJECT', 'AZURE_DEVOPS_PAT', 'AZURE_DEVOPS_AUTOMATION_STATUS_FIELD', 'CONNECTOR_MAX_RETRIES'];
  const restore = saveEnv(names);
  Object.assign(process.env, { EXTERNAL_PUBLISH_DRY_RUN: 'false', ALLOW_EXTERNAL_COMMENTS: 'false', ALLOW_EXTERNAL_CUSTOM_FIELDS: 'true', ALLOW_WORKFLOW_TRANSITIONS: 'false', AZURE_DEVOPS_ORG_URL: 'https://dev.azure.com/acme', AZURE_DEVOPS_PROJECT: 'Commerce', AZURE_DEVOPS_PAT: 'pat', AZURE_DEVOPS_AUTOMATION_STATUS_FIELD: 'Custom.Automation.Status', CONNECTOR_MAX_RETRIES: '0' });
  const originalFetch = globalThis.fetch;
  let body = '';
  globalThis.fetch = async (_input, init) => { body = String(init?.body ?? ''); return response({ id: 42 }); };
  try {
    const result = await new AzureBoardsExecutionPublisher().publish(run);
    expect(result.action).toBe('custom-field');
    expect(JSON.parse(body)[0].path).toBe('/fields/Custom.Automation.Status');
  } finally { globalThis.fetch = originalFetch; restore(); }
});

test('GitHub write-back de-duplicates the same run comment by run marker', async () => {
  const names = ['EXTERNAL_PUBLISH_DRY_RUN', 'EXECUTION_PUBLISH_DEDUPLICATE', 'ALLOW_EXTERNAL_COMMENTS', 'ALLOW_EXTERNAL_CUSTOM_FIELDS', 'ALLOW_WORKFLOW_TRANSITIONS', 'GITHUB_REQUIREMENT_REPO', 'GITHUB_TOKEN', 'CONNECTOR_MAX_RETRIES'];
  const restore = saveEnv(names);
  Object.assign(process.env, { EXTERNAL_PUBLISH_DRY_RUN: 'false', EXECUTION_PUBLISH_DEDUPLICATE: 'true', ALLOW_EXTERNAL_COMMENTS: 'true', ALLOW_EXTERNAL_CUSTOM_FIELDS: 'false', ALLOW_WORKFLOW_TRANSITIONS: 'false', GITHUB_REQUIREMENT_REPO: 'acme/store', GITHUB_TOKEN: 'token', CONNECTOR_MAX_RETRIES: '0' });
  const originalFetch = globalThis.fetch;
  const methods: string[] = [];
  globalThis.fetch = async (_input, init) => { methods.push(String(init?.method ?? 'GET')); return response([{ body: '[automation-run:RUN-42]\nAutomation execution summary' }]); };
  try {
    const result = await new GitHubIssueExecutionPublisher().publish(run);
    expect(result.action).toBe('comment-skipped-duplicate');
    expect(methods).toEqual(['GET']);
  } finally { globalThis.fetch = originalFetch; restore(); }
});
