/** Requirement source resolver for files, prefixes and direct ticket URLs. Author: Raushan Raj */
import { stat } from 'node:fs/promises';
import { readLocalRequirement } from './file.adapters.js';
import { AzureBoardsRequirementAdapter, GitHubIssueRequirementAdapter, JiraRequirementAdapter } from './remote.adapters.js';

function githubRef(source: string): { repo: string; id: string } | undefined {
  const compact = /^GITHUB:([^#\s]+\/[^#\s]+)#(\d+)$/i.exec(source);
  if (compact) return { repo: compact[1], id: compact[2] };
  try {
    const url = new URL(source);
    const match = /^\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/.exec(url.pathname);
    if (url.hostname.toLowerCase() === 'github.com' && match) return { repo: `${match[1]}/${match[2]}`, id: match[3] };
  } catch { /* not a URL */ }
  return undefined;
}

function jiraRef(source: string): { base: string; id: string } | undefined {
  try {
    const url = new URL(source);
    const match = /\/browse\/([A-Za-z][A-Za-z0-9_-]*-\d+)\/?$/.exec(url.pathname);
    if (match) return { base: url.origin, id: match[1] };
  } catch { /* not a URL */ }
  return undefined;
}

function azureRef(source: string): { org: string; project: string; id: string } | undefined {
  try {
    const url = new URL(source);
    if (url.hostname.toLowerCase() !== 'dev.azure.com') return undefined;
    const match = /^\/([^/]+)\/([^/]+)\/_workitems\/edit\/(\d+)\/?$/.exec(url.pathname);
    if (!match) return undefined;
    return { org: `${url.origin}/${match[1]}`, project: decodeURIComponent(match[2]), id: match[3] };
  } catch { return undefined; }
}

export async function loadRequirement(source: string) {
  if (/^JIRA:/i.test(source)) return new JiraRequirementAdapter().getRequirement(source.replace(/^JIRA:/i, ''));
  if (/^(?:AZURE|ADO):/i.test(source)) return new AzureBoardsRequirementAdapter().getRequirement(source.replace(/^(?:AZURE|ADO):/i, ''));

  const github = githubRef(source);
  if (github) return new GitHubIssueRequirementAdapter(github.repo).getRequirement(github.id);
  if (/^GITHUB:/i.test(source)) return new GitHubIssueRequirementAdapter().getRequirement(source.replace(/^GITHUB:/i, ''));

  const jira = jiraRef(source);
  if (jira) return new JiraRequirementAdapter(jira.base).getRequirement(jira.id);

  const azure = azureRef(source);
  if (azure) return new AzureBoardsRequirementAdapter(azure.org, azure.project).getRequirement(azure.id);

  try {
    if ((await stat(source)).isFile()) return readLocalRequirement(source);
  } catch { /* not a local file */ }

  throw new Error(`Unsupported source '${source}'. Use file.md/json/csv/xlsx, JIRA:<id>, AZURE:<id>, GITHUB:<id>, GITHUB:owner/repo#<id>, or a supported Jira/Azure/GitHub issue URL.`);
}
