/** Jira, Azure Boards and GitHub Issues requirement adapters. Author: Raushan Raj */
import type { RequirementSourceAdapter } from '../core/contracts.js';
import type { RequirementDocument } from '../core/models.js';
import { connectorBoolean, connectorJson } from '../connectors/http.client.js';
import { adfToPlainText, htmlToPlainText, parseManualStepLines, parseRequirementText, plainLines } from './requirement.text.js';

function trimSlash(value: string): string { return value.replace(/\/+$/, ''); }
function featureLabel(labels: string[]): string | undefined {
  const label = labels.find(item => /^feature[:/]/i.test(item));
  return label?.replace(/^feature[:/]\s*/i, '').trim() || undefined;
}
function priorityLabel(labels: string[]): string | undefined {
  const label = labels.find(item => /^priority[:/]/i.test(item));
  return label?.replace(/^priority[:/]\s*/i, '').trim() || undefined;
}

function jiraHeaders(email: string, token: string, bearer: string): Record<string, string> {
  if (bearer) return { Authorization: `Bearer ${bearer}`, Accept: 'application/json' };
  if (!email || !token) {
    if (connectorBoolean('JIRA_ALLOW_ANONYMOUS_READ', false)) return { Accept: 'application/json' };
    throw new Error('Set JIRA_BEARER_TOKEN or JIRA_EMAIL + JIRA_API_TOKEN for Jira Cloud reads (or JIRA_ALLOW_ANONYMOUS_READ=true for an anonymous-readable project).');
  }
  return { Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`, Accept: 'application/json' };
}

/**
 * Reusable framework class `JiraRequirementAdapter`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export class JiraRequirementAdapter implements RequirementSourceAdapter {
  constructor(
    private readonly base = process.env.JIRA_BASE_URL ?? '',
    private readonly email = process.env.JIRA_EMAIL ?? '',
    private readonly token = process.env.JIRA_API_TOKEN ?? '',
    private readonly bearer = process.env.JIRA_BEARER_TOKEN ?? ''
  ) {}

  async getRequirement(id: string): Promise<RequirementDocument> {
    if (!this.base) throw new Error('JIRA_BASE_URL is required.');
    const acceptanceField = process.env.JIRA_ACCEPTANCE_CRITERIA_FIELD_ID?.trim();
    const stepsField = process.env.JIRA_MANUAL_STEPS_FIELD_ID?.trim();
    const fields = ['summary', 'description', 'labels', 'priority', 'components', acceptanceField, stepsField].filter(Boolean).join(',');
    const url = `${trimSlash(this.base)}/rest/api/3/issue/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}`;
    const issue = await connectorJson<any>(url, { headers: jiraHeaders(this.email, this.token, this.bearer) });
    const f = issue.fields ?? {};
    const descriptionText = adfToPlainText(f.description).replace(/\n{3,}/g, '\n\n').trim();
    const parsed = parseRequirementText(descriptionText);
    const acceptanceText = acceptanceField ? adfToPlainText(f[acceptanceField]).trim() : '';
    const manualText = stepsField ? adfToPlainText(f[stepsField]).trim() : '';
    const labels = Array.isArray(f.labels) ? f.labels.map(String) : [];
    const key = String(issue.key ?? id);

    return {
      sourceType: 'jira',
      sourceId: key,
      title: String(f.summary ?? key),
      description: (parsed.description ?? descriptionText) || undefined,
      preconditions: parsed.preconditions,
      scenarioHints: parsed.scenarioHints,
      acceptanceCriteria: acceptanceText ? plainLines(acceptanceText) : parsed.acceptanceCriteria,
      manualTestSteps: manualText ? parseManualStepLines(manualText) : parsed.manualTestSteps,
      expectedResults: parsed.expectedResults,
      tags: labels,
      priority: f.priority?.name ? String(f.priority.name) : priorityLabel(labels),
      feature: f.components?.[0]?.name ? String(f.components[0].name) : featureLabel(labels),
      links: [`${trimSlash(this.base)}/browse/${encodeURIComponent(key)}`],
      raw: issue
    };
  }
}

function azureAuthHeaders(pat: string, accessToken: string): Record<string, string> {
  if (accessToken) return { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };
  if (pat) return { Authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}`, Accept: 'application/json' };
  throw new Error('Set AZURE_DEVOPS_ACCESS_TOKEN (recommended for automation) or AZURE_DEVOPS_PAT.');
}

/**
 * Reusable framework class `AzureBoardsRequirementAdapter`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export class AzureBoardsRequirementAdapter implements RequirementSourceAdapter {
  constructor(
    private readonly org = process.env.AZURE_DEVOPS_ORG_URL ?? '',
    private readonly project = process.env.AZURE_DEVOPS_PROJECT ?? '',
    private readonly pat = process.env.AZURE_DEVOPS_PAT ?? '',
    private readonly accessToken = process.env.AZURE_DEVOPS_ACCESS_TOKEN ?? ''
  ) {}

  async getRequirement(id: string): Promise<RequirementDocument> {
    if (!this.org || !this.project) throw new Error('AZURE_DEVOPS_ORG_URL and AZURE_DEVOPS_PROJECT are required.');
    const apiVersion = process.env.AZURE_DEVOPS_API_VERSION ?? '7.1';
    const url = `${trimSlash(this.org)}/${encodeURIComponent(this.project)}/_apis/wit/workitems/${encodeURIComponent(id)}?$expand=relations&api-version=${encodeURIComponent(apiVersion)}`;
    const item = await connectorJson<any>(url, { headers: azureAuthHeaders(this.pat, this.accessToken) });
    const f = item.fields ?? {};
    const descriptionField = process.env.AZURE_DEVOPS_DESCRIPTION_FIELD ?? 'System.Description';
    const acceptanceField = process.env.AZURE_DEVOPS_ACCEPTANCE_CRITERIA_FIELD ?? 'Microsoft.VSTS.Common.AcceptanceCriteria';
    const stepsField = process.env.AZURE_DEVOPS_MANUAL_STEPS_FIELD?.trim();
    const descriptionText = htmlToPlainText(String(f[descriptionField] ?? ''));
    const acceptanceText = htmlToPlainText(String(f[acceptanceField] ?? ''));
    const stepsText = stepsField ? htmlToPlainText(String(f[stepsField] ?? '')) : '';
    const parsed = parseRequirementText(descriptionText);
    const tags = String(f['System.Tags'] ?? '').split(';').map((value: string) => value.trim()).filter(Boolean);
    const workItemId = String(item.id ?? id);
    const links = [
      `${trimSlash(this.org)}/${encodeURIComponent(this.project)}/_workitems/edit/${encodeURIComponent(workItemId)}`,
      ...(item.relations ?? []).map((relation: any) => String(relation.url ?? '')).filter(Boolean)
    ];

    return {
      sourceType: 'azure-boards',
      sourceId: workItemId,
      title: String(f['System.Title'] ?? workItemId),
      description: (parsed.description ?? descriptionText) || undefined,
      preconditions: parsed.preconditions,
      scenarioHints: parsed.scenarioHints,
      acceptanceCriteria: acceptanceText ? plainLines(acceptanceText) : parsed.acceptanceCriteria,
      manualTestSteps: stepsText ? parseManualStepLines(stepsText) : parsed.manualTestSteps,
      expectedResults: parsed.expectedResults,
      tags,
      priority: f['Microsoft.VSTS.Common.Priority'] != null ? String(f['Microsoft.VSTS.Common.Priority']) : priorityLabel(tags),
      feature: f['System.AreaPath'] ? String(f['System.AreaPath']) : featureLabel(tags),
      links,
      raw: item
    };
  }
}

/**
 * Reusable framework class `GitHubIssueRequirementAdapter`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export class GitHubIssueRequirementAdapter implements RequirementSourceAdapter {
  constructor(
    private readonly repo = process.env.GITHUB_REQUIREMENT_REPO ?? '',
    private readonly token = process.env.GITHUB_TOKEN ?? '',
    private readonly apiBase = process.env.GITHUB_API_URL ?? 'https://api.github.com'
  ) {}

  async getRequirement(id: string): Promise<RequirementDocument> {
    if (!this.repo || !/^[-\w.]+\/[-\w.]+$/.test(this.repo)) throw new Error('GITHUB_REQUIREMENT_REPO must be owner/repo.');
    const version = process.env.GITHUB_API_VERSION ?? '2026-03-10';
    const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': version };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const issue = await connectorJson<any>(`${trimSlash(this.apiBase)}/repos/${this.repo}/issues/${encodeURIComponent(id)}`, { headers });
    if (issue.pull_request && !connectorBoolean('GITHUB_ALLOW_PULL_REQUEST_SOURCE', false)) {
      throw new Error(`GitHub #${id} is a pull request, not an issue. Set GITHUB_ALLOW_PULL_REQUEST_SOURCE=true only if that is intentional.`);
    }
    const body = String(issue.body ?? '');
    const parsed = parseRequirementText(body);
    const labels = (issue.labels ?? []).map((label: any) => typeof label === 'string' ? label : String(label.name ?? '')).filter(Boolean);
    const number = String(issue.number ?? id);

    return {
      sourceType: 'github-issues',
      sourceId: number,
      title: String(issue.title ?? number),
      description: (parsed.description ?? body) || undefined,
      preconditions: parsed.preconditions,
      scenarioHints: parsed.scenarioHints,
      acceptanceCriteria: parsed.acceptanceCriteria,
      manualTestSteps: parsed.manualTestSteps,
      expectedResults: parsed.expectedResults,
      tags: labels,
      priority: priorityLabel(labels),
      feature: featureLabel(labels),
      links: issue.html_url ? [String(issue.html_url)] : [`https://github.com/${this.repo}/issues/${number}`],
      raw: issue
    };
  }
}
