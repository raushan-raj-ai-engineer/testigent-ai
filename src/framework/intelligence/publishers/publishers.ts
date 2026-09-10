/** Optional execution-result publishers for Jira, Azure Boards and GitHub Issues. Author: Raushan Raj */
import type { ExecutionStatusPublisher } from '../core/contracts.js';
import type { ExecutionPublishRequest, ExecutionStatus, PublishResult } from '../core/models.js';
import { intelligenceFlags } from '../core/flags.js';
import { connectorBoolean, connectorJson, jsonPointerSegment } from '../connectors/http.client.js';
import { adfToPlainText } from '../adapters/requirement.text.js';

function trimSlash(value: string): string { return value.replace(/\/+$/, ''); }
function runMarker(runId: string): string { return `[automation-run:${runId}]`; }
function mapped(prefix: string, status: ExecutionStatus): string { return process.env[`${prefix}_${status}`] ?? status; }
function dryRun(): boolean { return connectorBoolean('EXTERNAL_PUBLISH_DRY_RUN', false); }
function dedupe(): boolean { return connectorBoolean('EXECUTION_PUBLISH_DEDUPLICATE', true); }

function summary(x: ExecutionPublishRequest): string {
  const failed = (x.failedScenarios ?? []).slice(0, 10).map(s => `- ${s}`).join('\n');
  return `${runMarker(x.runId)}\nAutomation execution summary\n\nRun: ${x.runId}\nEnvironment: ${x.environment ?? 'unknown'}\nStatus: ${x.status}\nTotal: ${x.total}\nPassed: ${x.passed}\nFailed: ${x.failed}\nSkipped: ${x.skipped}\nFlaky: ${x.flaky ?? 0}\nSelf-Healed: ${x.selfHealed ?? 0}\nAI Healing: ${x.aiHealing ?? 0}${x.dashboardUrl ? `\nDashboard: ${x.dashboardUrl}` : ''}${failed ? `\n\nFailed scenarios:\n${failed}` : ''}`;
}

function plannedActions(target: 'jira' | 'azure-boards' | 'github', x: ExecutionPublishRequest): string[] {
  const actions: string[] = [];
  if (intelligenceFlags.allowComments()) actions.push('comment');
  if (target === 'jira' && process.env.JIRA_AUTOMATION_STATUS_FIELD_ID && intelligenceFlags.allowCustomFields()) actions.push('custom-field');
  if (target === 'azure-boards' && process.env.AZURE_DEVOPS_AUTOMATION_STATUS_FIELD && intelligenceFlags.allowCustomFields()) actions.push('custom-field');
  if (target === 'github' && intelligenceFlags.allowCustomFields()) actions.push('label');
  if (target === 'jira' && (process.env[`JIRA_TRANSITION_${x.status}_ID`] || process.env.JIRA_TRANSITION_ID) && intelligenceFlags.allowTransitions()) actions.push('workflow-transition');
  if (target === 'azure-boards' && process.env[`AZURE_DEVOPS_STATE_${x.status}`] && intelligenceFlags.allowTransitions()) actions.push('workflow-transition');
  if (target === 'github' && process.env[`GITHUB_STATE_${x.status}`] && intelligenceFlags.allowTransitions()) actions.push('workflow-transition');
  return actions;
}

function jiraWriteHeaders(): Record<string, string> {
  const bearer = process.env.JIRA_BEARER_TOKEN ?? '';
  if (bearer) return { Authorization: `Bearer ${bearer}`, Accept: 'application/json', 'Content-Type': 'application/json' };
  const email = process.env.JIRA_EMAIL ?? '', token = process.env.JIRA_API_TOKEN ?? '';
  if (!email || !token) throw new Error('Set JIRA_BEARER_TOKEN or JIRA_EMAIL + JIRA_API_TOKEN for Jira writes.');
  return { Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`, Accept: 'application/json', 'Content-Type': 'application/json' };
}

async function jiraCommentExists(base: string, issue: string, marker: string, headers: Record<string, string>): Promise<boolean> {
  if (!dedupe()) return false;
  const data = await connectorJson<any>(`${trimSlash(base)}/rest/api/3/issue/${encodeURIComponent(issue)}/comment?maxResults=100`, { headers });
  return (data.comments ?? []).some((comment: any) => adfToPlainText(comment.body).includes(marker));
}

export class JiraExecutionPublisher implements ExecutionStatusPublisher {
  async publish(x: ExecutionPublishRequest): Promise<PublishResult> {
    const actions = plannedActions('jira', x);
    if (!actions.length) return { target: 'jira', requirementId: x.requirementId, action: 'none', success: true, message: 'No Jira write action enabled.' };
    if (dryRun()) return { target: 'jira', requirementId: x.requirementId, action: `dry-run:${actions.join(',')}`, success: true, message: 'EXTERNAL_PUBLISH_DRY_RUN=true; Jira was not modified.' };

    const base = process.env.JIRA_BASE_URL ?? '';
    if (!base) throw new Error('JIRA_BASE_URL is required for Jira writes.');
    const headers = jiraWriteHeaders();
    const completed: string[] = [];
    const marker = runMarker(x.runId);

    if (actions.includes('comment')) {
      if (await jiraCommentExists(base, x.requirementId, marker, headers)) completed.push('comment-skipped-duplicate');
      else {
        await connectorJson(`${trimSlash(base)}/rest/api/3/issue/${encodeURIComponent(x.requirementId)}/comment`, {
          method: 'POST', headers,
          body: JSON.stringify({ body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: summary(x) }] }] } })
        });
        completed.push('comment');
      }
    }

    if (actions.includes('custom-field')) {
      const field = process.env.JIRA_AUTOMATION_STATUS_FIELD_ID as string;
      const value = mapped('JIRA_AUTOMATION_STATUS_VALUE', x.status);
      const mode = (process.env.JIRA_AUTOMATION_STATUS_FIELD_MODE ?? 'string').toLowerCase();
      const fieldValue = mode === 'option-value' ? { value } : mode === 'option-id' ? { id: value } : value;
      await connectorJson(`${trimSlash(base)}/rest/api/3/issue/${encodeURIComponent(x.requirementId)}`, {
        method: 'PUT', headers, body: JSON.stringify({ fields: { [field]: fieldValue } })
      });
      completed.push('custom-field');
    }

    if (actions.includes('workflow-transition')) {
      const transition = process.env[`JIRA_TRANSITION_${x.status}_ID`] ?? process.env.JIRA_TRANSITION_ID;
      await connectorJson(`${trimSlash(base)}/rest/api/3/issue/${encodeURIComponent(x.requirementId)}/transitions`, {
        method: 'POST', headers, body: JSON.stringify({ transition: { id: transition } })
      });
      completed.push('workflow-transition');
    }

    return { target: 'jira', requirementId: x.requirementId, action: completed.join(','), success: true, message: 'Published configured Jira actions.' };
  }
}

function azureHeaders(contentType = 'application/json'): Record<string, string> {
  const accessToken = process.env.AZURE_DEVOPS_ACCESS_TOKEN ?? '';
  const pat = process.env.AZURE_DEVOPS_PAT ?? '';
  const auth = accessToken ? `Bearer ${accessToken}` : pat ? `Basic ${Buffer.from(`:${pat}`).toString('base64')}` : '';
  if (!auth) throw new Error('Set AZURE_DEVOPS_ACCESS_TOKEN (recommended for automation) or AZURE_DEVOPS_PAT for Azure DevOps writes.');
  return { Authorization: auth, Accept: 'application/json', 'Content-Type': contentType };
}

async function azureCommentExists(org: string, project: string, issue: string, marker: string): Promise<boolean> {
  if (!dedupe()) return false;
  const version = process.env.AZURE_DEVOPS_COMMENTS_API_VERSION ?? '7.1-preview.4';
  const data = await connectorJson<any>(`${trimSlash(org)}/${encodeURIComponent(project)}/_apis/wit/workItems/${encodeURIComponent(issue)}/comments?$top=100&api-version=${encodeURIComponent(version)}`, { headers: azureHeaders() });
  return (data.comments ?? []).some((comment: any) => String(comment.text ?? '').includes(marker));
}

export class AzureBoardsExecutionPublisher implements ExecutionStatusPublisher {
  async publish(x: ExecutionPublishRequest): Promise<PublishResult> {
    const actions = plannedActions('azure-boards', x);
    if (!actions.length) return { target: 'azure-boards', requirementId: x.requirementId, action: 'none', success: true, message: 'No Azure Boards write action enabled.' };
    if (dryRun()) return { target: 'azure-boards', requirementId: x.requirementId, action: `dry-run:${actions.join(',')}`, success: true, message: 'EXTERNAL_PUBLISH_DRY_RUN=true; Azure Boards was not modified.' };

    const org = process.env.AZURE_DEVOPS_ORG_URL ?? '', project = process.env.AZURE_DEVOPS_PROJECT ?? '';
    if (!org || !project) throw new Error('AZURE_DEVOPS_ORG_URL and AZURE_DEVOPS_PROJECT are required for Azure Boards writes.');
    const completed: string[] = [];
    const marker = runMarker(x.runId);

    if (actions.includes('comment')) {
      if (await azureCommentExists(org, project, x.requirementId, marker)) completed.push('comment-skipped-duplicate');
      else {
        const version = process.env.AZURE_DEVOPS_COMMENTS_API_VERSION ?? '7.1-preview.4';
        await connectorJson(`${trimSlash(org)}/${encodeURIComponent(project)}/_apis/wit/workItems/${encodeURIComponent(x.requirementId)}/comments?api-version=${encodeURIComponent(version)}`, {
          method: 'POST', headers: azureHeaders(), body: JSON.stringify({ text: summary(x) })
        });
        completed.push('comment');
      }
    }

    const patches: Array<{ op: 'add'; path: string; value: string }> = [];
    if (actions.includes('custom-field')) {
      const field = process.env.AZURE_DEVOPS_AUTOMATION_STATUS_FIELD as string;
      patches.push({ op: 'add', path: `/fields/${jsonPointerSegment(field)}`, value: mapped('AZURE_DEVOPS_AUTOMATION_STATUS_VALUE', x.status) });
      completed.push('custom-field');
    }
    if (actions.includes('workflow-transition')) {
      patches.push({ op: 'add', path: '/fields/System.State', value: process.env[`AZURE_DEVOPS_STATE_${x.status}`] as string });
      completed.push('workflow-transition');
    }
    if (patches.length) {
      const version = process.env.AZURE_DEVOPS_API_VERSION ?? '7.1';
      await connectorJson(`${trimSlash(org)}/${encodeURIComponent(project)}/_apis/wit/workitems/${encodeURIComponent(x.requirementId)}?api-version=${encodeURIComponent(version)}`, {
        method: 'PATCH', headers: azureHeaders('application/json-patch+json'), body: JSON.stringify(patches)
      });
    }

    return { target: 'azure-boards', requirementId: x.requirementId, action: completed.join(','), success: true, message: 'Published configured Azure Boards actions.' };
  }
}

function githubHeaders(contentType = 'application/json'): Record<string, string> {
  const token = process.env.GITHUB_TOKEN ?? '';
  if (!token) throw new Error('GITHUB_TOKEN is required for GitHub issue writes.');
  return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': contentType, 'X-GitHub-Api-Version': process.env.GITHUB_API_VERSION ?? '2026-03-10' };
}

async function githubCommentExists(api: string, repo: string, issue: string, marker: string): Promise<boolean> {
  if (!dedupe()) return false;
  const comments = await connectorJson<any[]>(`${trimSlash(api)}/repos/${repo}/issues/${encodeURIComponent(issue)}/comments?per_page=100`, { headers: githubHeaders() });
  return comments.some(comment => String(comment.body ?? '').includes(marker));
}

export class GitHubIssueExecutionPublisher implements ExecutionStatusPublisher {
  async publish(x: ExecutionPublishRequest): Promise<PublishResult> {
    const actions = plannedActions('github', x);
    if (!actions.length) return { target: 'github', requirementId: x.requirementId, action: 'none', success: true, message: 'No GitHub issue write action enabled.' };
    if (dryRun()) return { target: 'github', requirementId: x.requirementId, action: `dry-run:${actions.join(',')}`, success: true, message: 'EXTERNAL_PUBLISH_DRY_RUN=true; GitHub was not modified.' };

    const repo = process.env.GITHUB_REQUIREMENT_REPO ?? '', api = process.env.GITHUB_API_URL ?? 'https://api.github.com';
    if (!repo || !/^[-\w.]+\/[-\w.]+$/.test(repo)) throw new Error('GITHUB_REQUIREMENT_REPO must be owner/repo for GitHub writes.');
    const headers = githubHeaders();
    const completed: string[] = [];
    const marker = runMarker(x.runId);

    if (actions.includes('comment')) {
      if (await githubCommentExists(api, repo, x.requirementId, marker)) completed.push('comment-skipped-duplicate');
      else {
        await connectorJson(`${trimSlash(api)}/repos/${repo}/issues/${encodeURIComponent(x.requirementId)}/comments`, {
          method: 'POST', headers, body: JSON.stringify({ body: summary(x) })
        });
        completed.push('comment');
      }
    }

    if (actions.includes('label')) {
      const prefix = process.env.GITHUB_STATUS_LABEL_PREFIX ?? 'automation';
      const label = `${prefix}:${mapped('GITHUB_AUTOMATION_STATUS_VALUE', x.status).toLowerCase()}`;
      const issue = await connectorJson<any>(`${trimSlash(api)}/repos/${repo}/issues/${encodeURIComponent(x.requirementId)}`, { headers });
      const existing = (issue.labels ?? []).map((item: any) => typeof item === 'string' ? item : String(item.name ?? '')).filter(Boolean);
      for (const oldLabel of existing.filter((item: string) => item.startsWith(`${prefix}:`) && item !== label)) {
        await connectorJson(`${trimSlash(api)}/repos/${repo}/issues/${encodeURIComponent(x.requirementId)}/labels/${encodeURIComponent(oldLabel)}`, { method: 'DELETE', headers });
      }
      if (!existing.includes(label)) {
        await connectorJson(`${trimSlash(api)}/repos/${repo}/issues/${encodeURIComponent(x.requirementId)}/labels`, {
          method: 'POST', headers, body: JSON.stringify({ labels: [label] })
        });
      }
      completed.push('label');
    }

    if (actions.includes('workflow-transition')) {
      const state = process.env[`GITHUB_STATE_${x.status}`] as string;
      if (!['open', 'closed'].includes(state)) throw new Error(`GITHUB_STATE_${x.status} must be 'open' or 'closed'.`);
      await connectorJson(`${trimSlash(api)}/repos/${repo}/issues/${encodeURIComponent(x.requirementId)}`, {
        method: 'PATCH', headers, body: JSON.stringify({ state })
      });
      completed.push('workflow-transition');
    }

    return { target: 'github', requirementId: x.requirementId, action: completed.join(','), success: true, message: 'Published configured GitHub issue actions.' };
  }
}

export function publisherFor(target: string): ExecutionStatusPublisher {
  switch (target.toLowerCase()) {
    case 'jira': return new JiraExecutionPublisher();
    case 'azure': case 'ado': case 'azure-boards': return new AzureBoardsExecutionPublisher();
    case 'github': case 'github-issues': return new GitHubIssueExecutionPublisher();
    default: throw new Error(`Unsupported execution publisher target: ${target}`);
  }
}
