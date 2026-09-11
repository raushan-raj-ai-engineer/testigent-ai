/** Existing framework discovery. Author: Raushan Raj */
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { ReusableCandidate } from '../core/models.js';

const IGNORE = new Set(['node_modules', '.git', 'reports', 'test-results', 'dist', 'coverage', '.application-knowledge', 'generated']);
const STOP_WORDS = new Set([
  'the','and','for','with','from','into','during','using','used','use','can','should','able','customer','existing','available','success','successful',
  'becomes','stored','record','returns','return','display','displays','message','requirement','critical','feature','test','tests','step','steps','verify','verification',
  'ui','api','db','database','page','pages','component','components','workflow','workflows','service','services','client','clients','repository','repositories','fixture',
  'fixtures','data','factory','schema','request','response','http','status','code','application','applications','src','core','async','await','class','export','import','const'
]);

async function walk(directory: string, output: string[] = []): Promise<string[]> {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return output; }
  for (const entry of entries) {
    if (IGNORE.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path, output);
    else if (/\.(?:ts|tsx|js|mjs|cjs)$/.test(entry.name)) output.push(path);
  }
  return output;
}

function normalizePath(value: string): string { return value.replace(/\\/g, '/'); }

function reusableKind(path: string): ReusableCandidate['kind'] | undefined {
  const normalized = normalizePath(path).toLowerCase();
  const srcIndex = normalized.lastIndexOf('/src/');
  const scoped = srcIndex >= 0 ? normalized.slice(srcIndex) : normalized;
  if (/\/projects\/[^/]+\/src\/pages\//.test(normalized)) return 'page';
  if (/\/projects\/[^/]+\/src\/components\//.test(normalized)) return 'component';
  if (/\/projects\/[^/]+\/src\/workflows\//.test(normalized)) return 'workflow';
  if (/\/projects\/[^/]+\/src\/api\//.test(normalized)) return 'api-service';
  if (/\/projects\/[^/]+\/src\/(?:database|db)\//.test(normalized)) return 'db-repository';
  if (/\/api\/(?:services|clients)\//.test(scoped)) return 'api-service';
  if (/\/(?:database|db)\/repositories\//.test(scoped)) return 'db-repository';
  if (/\/core\/fixtures\//.test(scoped) || /\/fixtures\//.test(scoped)) return 'fixture';
  if (/\/data\//.test(scoped)) return 'data';
  return undefined;
}

/**
 * Reusable framework function `semanticTokens`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export function semanticTokens(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/)
    .filter(token => token.length > 2 && !/^\d+$/.test(token) && !STOP_WORDS.has(token)));
}

function intersection(query: Set<string>, candidate: Set<string>): string[] {
  return [...query].filter(token => candidate.has(token)).sort();
}

/**
 * Reusable framework function `discoverReusable`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export async function discoverReusable(root: string, query: string, limit = 20): Promise<ReusableCandidate[]> {
  const files = [...await walk(join(root, 'src')), ...await walk(join(root, 'projects'))];
  const queryTokens = semanticTokens(query);
  const output: ReusableCandidate[] = [];
  if (!queryTokens.size) return output;

  for (const path of files) {
    const kind = reusableKind(path);
    if (!kind) continue;
    const relativePath = normalizePath(relative(root, path));
    const pathTokens = semanticTokens(relativePath);
    let content = '';
    try { content = (await readFile(path, 'utf8')).slice(0, 20_000); } catch { /* ignore unreadable */ }
    if (content.includes('GENERATED PROPOSAL - REVIEW_REQUIRED')) continue;
    const contentTokens = semanticTokens(content);
    const pathMatches = intersection(queryTokens, pathTokens);
    const contentMatches = intersection(queryTokens, contentTokens);
    const allMatches = [...new Set([...pathMatches, ...contentMatches])];

    // A path/name match is strongest. Content-only reuse requires two meaningful domain terms.
    if (!pathMatches.length && contentMatches.length < 2) continue;
    const score = Number(Math.min(0.99,
      0.30 + Math.min(pathMatches.length, 3) * 0.22 + Math.min(contentMatches.length, 4) * 0.035
    ).toFixed(2));
    output.push({
      kind,
      name: path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? path,
      path: relativePath,
      score,
      matchedTerms: allMatches
    });
  }

  return output.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path)).slice(0, limit);
}
