/** Safe target-application resolver for generated automation and exploration. Author: Raushan Raj */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ApplicationResolution, RequirementDocument, ReusableCandidate } from '../core/models.js';
import { WorkspaceContext } from '../../core/config/workspace.context.js';

interface ConfigApplication { name?: string; uiBaseUrl?: string; apiBaseUrl?: string; }
interface EnvironmentConfigFile { applications?: Record<string, ConfigApplication>; }

function safeUrl(value: string | undefined): URL | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function sameApplicationUrl(left: string | undefined, right: string | undefined): boolean {
  const a = safeUrl(left);
  const b = safeUrl(right);
  if (!a || !b || a.origin !== b.origin) return false;
  const normalize = (pathname: string): string => pathname.replace(/\/+$/, '') || '/';
  const ap = normalize(a.pathname);
  const bp = normalize(b.pathname);
  return ap === '/' || bp === '/' || ap === bp || ap.startsWith(`${bp}/`) || bp.startsWith(`${ap}/`);
}

async function applicationDirectories(root: string): Promise<string[]> {
  try {
    const entries = await readdir(join(root, 'projects'), { withFileTypes: true });
    return entries.filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  } catch {
    return [];
  }
}

async function configuredApplications(root: string): Promise<Record<string, ConfigApplication>> {
  const workspace = WorkspaceContext.read(root);
  const env = process.env.ENV?.trim() || process.env.TEST_ENV?.trim() || workspace?.environment;
  if (!env) return {};
  const applications: Record<string, ConfigApplication> = {};
  for (const project of await applicationDirectories(root)) {
    try {
      const parsed = JSON.parse(await readFile(join(root, 'projects', project, 'config', `${env}.json`), 'utf8')) as { application?: ConfigApplication };
      if (parsed.application) applications[project] = parsed.application;
    } catch { /* project may not support this environment */ }
  }
  return applications;
}

function appTag(requirement: RequirementDocument): string | undefined {
  for (const tag of requirement.tags) {
    const match = /^@?app[:=]([a-z0-9._-]+)$/i.exec(tag.trim());
    if (match?.[1]) return match[1];
  }
  return undefined;
}

function appFromCandidate(candidate: ReusableCandidate): string | undefined {
  const match = /(?:^|\/)projects\/([^/]+)\//i.exec(candidate.path.replace(/\\/g, '/'));
  return match?.[1];
}

function featureReuseApplication(candidates: ReusableCandidate[]): string | undefined {
  const votes = new Map<string, number>();
  for (const candidate of candidates) {
    if (candidate.role !== 'feature') continue;
    const app = appFromCandidate(candidate);
    if (!app) continue;
    votes.set(app, (votes.get(app) ?? 0) + candidate.score);
  }
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return undefined;
  if (ranked.length > 1 && Math.abs(ranked[0][1] - ranked[1][1]) < 0.15) return undefined;
  return ranked[0][0];
}

/**
 * Reusable framework function `resolveApplicationTarget`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export async function resolveApplicationTarget(
  root: string,
  requirement: RequirementDocument,
  candidates: ReusableCandidate[] = [],
  baseUrl = process.env.APP_BASE_URL
): Promise<ApplicationResolution> {
  const directories = await applicationDirectories(root);
  const configured = await configuredApplications(root);
  const known = [...new Set([...directories, ...Object.keys(configured)])].sort();
  const fromTag = appTag(requirement);
  const fromEnv = process.env.APP?.trim() || WorkspaceContext.read(root)?.application || undefined;
  const url = safeUrl(baseUrl);
  const fromUrl = url
    ? Object.entries(configured).find(([, config]) => sameApplicationUrl(config.uiBaseUrl, url.toString()))?.[0]
    : undefined;
  const fromFeatureReuse = featureReuseApplication(candidates);

  const explicitSignals = [
    fromTag ? { name: fromTag, source: 'tag' as const } : undefined,
    fromEnv ? { name: fromEnv, source: 'environment' as const } : undefined,
    fromUrl ? { name: fromUrl, source: 'url-config' as const } : undefined
  ].filter((value): value is { name: string; source: 'tag'|'environment'|'url-config' } => Boolean(value));

  const distinctExplicit = [...new Set(explicitSignals.map(item => item.name))];
  if (distinctExplicit.length > 1) {
    return {
      source: 'conflict',
      reason: `Application mapping conflict: ${explicitSignals.map(item => `${item.source}=${item.name}`).join(', ')}. Align APP/@app with APP_BASE_URL before generation.`,
      baseUrl: url?.toString(),
      candidates: known
    };
  }

  if (fromEnv && url && configured[fromEnv]?.uiBaseUrl && !sameApplicationUrl(configured[fromEnv].uiBaseUrl, url.toString())) {
    return {
      source: 'conflict',
      reason: `APP='${fromEnv}' is configured for '${configured[fromEnv].uiBaseUrl}', but APP_BASE_URL is '${url.toString()}'. Refusing to generate into the wrong application.`,
      baseUrl: url.toString(),
      candidates: known
    };
  }

  if (fromTag) return { app: fromTag, source: 'tag', reason: `Resolved from requirement tag @app:${fromTag}.`, baseUrl: url?.toString(), candidates: known };
  if (fromEnv) {
    const source = known.includes(fromEnv) ? 'environment' : 'explicit-new-app';
    return { app: fromEnv, source, reason: known.includes(fromEnv) ? `Resolved from APP=${fromEnv}.` : `APP=${fromEnv} explicitly names a new application; framework folders may be created for it.`, baseUrl: url?.toString(), candidates: known };
  }
  if (fromUrl) return { app: fromUrl, source: 'url-config', reason: `APP_BASE_URL matches configured application '${fromUrl}'.`, baseUrl: url?.toString(), candidates: known };
  if (fromFeatureReuse) return { app: fromFeatureReuse, source: 'feature-reuse', reason: `Resolved from feature-matched reusable abstractions under application '${fromFeatureReuse}'.`, baseUrl: url?.toString(), candidates: known };
  if (known.length === 1) return { app: known[0], source: 'single-app', reason: `Only one application is configured/present: '${known[0]}'.`, baseUrl: url?.toString(), candidates: known };

  const urlMessage = url ? ` APP_BASE_URL='${url.toString()}' is not mapped to a configured application.` : '';
  return {
    source: 'unresolved',
    reason: `Target application is ambiguous.${urlMessage} Set APP=<application>, add @app:<application>, or map the URL in the selected projects/<application>/config/<environment>.json before generation.`,
    baseUrl: url?.toString(),
    candidates: known
  };
}

/**
 * Reusable framework function `resolveApplicationForUrl`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export async function resolveApplicationForUrl(root: string, baseUrl: string): Promise<ApplicationResolution> {
  const synthetic: RequirementDocument = {
    sourceType: 'unknown', sourceId: 'application-exploration', title: 'Application exploration',
    acceptanceCriteria: [], manualTestSteps: [], expectedResults: [], tags: [], links: []
  };
  return resolveApplicationTarget(root, synthetic, [], baseUrl);
}
