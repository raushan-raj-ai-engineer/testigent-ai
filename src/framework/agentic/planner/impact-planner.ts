import fs from 'node:fs';
import path from 'node:path';
import type { AgentEvidenceReference } from '../contracts/agent.types.js';
import type { AgenticImpactCandidate, AgenticImpactResult } from '../contracts/plan.types.js';
import { assertSafeProjectName, resolveWorkspacePath } from '../policy/path-policy.js';

const STOP = new Set(['index', 'spec', 'test', 'tests', 'src', 'page', 'service', 'client', 'workflow', 'api', 'database', 'repository', 'fixture', 'generated']);
function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter(token => token.length > 2 && !STOP.has(token)));
}
function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry: { name: string; isDirectory(): boolean }) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

/** Performs deterministic, project-scoped change-impact planning without invoking an AI provider. */
export function analyzeAgenticImpact(root: string, project: string, changedPaths: string[]): AgenticImpactResult {
  assertSafeProjectName(project);
  const normalized = [...new Set(changedPaths.map(value => value.replaceAll('\\', '/').trim()).filter(Boolean))];
  const evidence: AgentEvidenceReference[] = normalized.map(ref => ({ kind: 'source', ref, description: 'Changed path supplied to deterministic impact analysis.' }));
  const queryTokens = new Set(normalized.flatMap(value => [...tokens(value)]));
  const testsRoot = resolveWorkspacePath(root, `projects/${project}/tests`);
  const candidates: AgenticImpactCandidate[] = [];
  for (const file of walk(testsRoot).filter(value => /\.spec\.(?:ts|js)$/.test(value))) {
    const relative = path.relative(root, file).replaceAll('\\', '/');
    const text = fs.readFileSync(file, 'utf8');
    const reasons: string[] = [];
    let score = 0;
    for (const changed of normalized) {
      const base = path.basename(changed).replace(/\.[^.]+$/, '');
      if (base && text.includes(base)) { score += 0.55; reasons.push(`References changed symbol/path token '${base}'.`); }
    }
    const overlap = [...queryTokens].filter(token => tokens(`${relative} ${text.slice(0, 20_000)}`).has(token));
    if (overlap.length) { score += Math.min(0.4, overlap.length * 0.08); reasons.push(`Domain token overlap: ${overlap.slice(0, 6).join(', ')}.`); }
    if (score > 0) candidates.push({ testPath: relative, score: Number(Math.min(0.99, score).toFixed(2)), reasons: [...new Set(reasons)] });
  }
  candidates.sort((a, b) => b.score - a.score || a.testPath.localeCompare(b.testPath));
  return {
    version: 1,
    project,
    state: normalized.length === 0 ? 'INSUFFICIENT_EVIDENCE' : candidates.length ? 'ACCEPTED' : 'REVIEW_REQUIRED',
    changedPaths: normalized,
    affectedTests: candidates,
    rationale: normalized.length === 0 ? 'No change paths were supplied.' : candidates.length ? `${candidates.length} potentially impacted test(s) identified deterministically.` : 'No confident deterministic test match was found; human review is required.',
    evidence,
  };
}
