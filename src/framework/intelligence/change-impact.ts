import fs from 'node:fs';
import path from 'node:path';

export interface ChangeImpactTest {
  file: string;
  reasons: string[];
  requirements: string[];
  critical: boolean;
}

export interface ChangeImpactResult {
  schemaVersion: 1;
  generatedAt: string;
  application: string;
  changedFiles: string[];
  projectChangedFiles: string[];
  frameworkChangedFiles: string[];
  selectedTests: ChangeImpactTest[];
  requirements: string[];
  selectionMode: 'targeted' | 'all-project-tests' | 'no-tests';
  caveats: string[];
}

/**
 * Author: Raushan Raj
 * Business Use: Explains which project tests are affected by a source change using repository import/requirement evidence.
 * How to use: Pass changed repository paths plus the selected project root to analyzeChangeImpact().
 * Benefit: Enables transparent test selection recommendations without hiding why a scenario was selected.
 */
export function analyzeChangeImpact(input: { root: string; application: string; changedFiles: string[] }): ChangeImpactResult {
  const root = path.resolve(input.root);
  const projectRoot = path.join(root, 'projects', input.application);
  if (!fs.existsSync(projectRoot)) throw new Error(`Unknown application '${input.application}'.`);

  const changedFiles = unique(input.changedFiles.map(file => normalizeRepoPath(root, file)).filter(Boolean));
  const projectPrefix = `projects/${input.application}/`;
  const projectChangedFiles = changedFiles.filter(file => file.startsWith(projectPrefix));
  const frameworkChangedFiles = changedFiles.filter(file => file.startsWith('src/framework/') || isSharedConfig(file));
  const tests = collectFiles(path.join(projectRoot, 'tests')).filter(file => /\.(?:ts|tsx)$/.test(file));
  const sourceFiles = collectFiles(projectRoot).filter(file => /\.(?:ts|tsx)$/.test(file));
  const dependencyGraph = buildDependencyGraph(root, sourceFiles);
  const selected = new Map<string, Set<string>>();
  const testText = new Map(tests.map(test => [repoPath(root, test), fs.readFileSync(test, 'utf8')]));
  const dependencyImpact = new Map<string, boolean>();

  const projectWideFiles = projectChangedFiles.filter(file => isProjectWideChange(projectPrefix, file));
  if (frameworkChangedFiles.length || projectWideFiles.length) {
    const reasons: string[] = [];
    if (frameworkChangedFiles.length) reasons.push(`shared framework/config changed: ${frameworkChangedFiles.slice(0, 3).join(', ')}${frameworkChangedFiles.length > 3 ? '…' : ''}`);
    if (projectWideFiles.length) reasons.push(`project-wide configuration/data changed: ${projectWideFiles.slice(0, 3).join(', ')}${projectWideFiles.length > 3 ? '…' : ''}`);
    for (const test of tests) for (const reason of reasons) addReason(selected, repoPath(root, test), reason);
  } else {
    for (const changed of projectChangedFiles) {
      if (/\/tests\//.test(`/${changed}`) && /\.(?:ts|tsx)$/.test(changed)) addReason(selected, changed, 'test file changed directly');
      const hints = featureHints(changed);
      for (const test of tests) {
        const testRepo = repoPath(root, test);
        const dependencyKey = `${testRepo}\u0000${changed}`;
        let impacted = dependencyImpact.get(dependencyKey);
        if (impacted === undefined) {
          impacted = dependsOn(dependencyGraph, testRepo, changed);
          dependencyImpact.set(dependencyKey, impacted);
        }
        if (impacted) addReason(selected, testRepo, `dependency changed: ${changed}`);
        const searchable = `${testRepo}\n${testText.get(testRepo) ?? ''}`.toLowerCase();
        const matchedHint = hints.find(hint => searchable.includes(hint));
        if (matchedHint) addReason(selected, testRepo, `feature ownership hint matched '${matchedHint}' for ${changed}`);
      }
    }

    const requirementChanges = projectChangedFiles.filter(file => file.includes('/requirements/'));
    for (const requirementFile of requirementChanges) {
      const ids = requirementFileIds(requirementFile);
      let mapped = 0;
      for (const test of tests) {
        const testRepo = repoPath(root, test);
        const text = testText.get(testRepo) ?? '';
        const tags = requirementTags(text);
        if (ids.some(id => tags.includes(id))) {
          addReason(selected, testRepo, `requirement changed: ${ids.join(', ')}`);
          mapped += 1;
        }
      }
      if (mapped === 0) {
        for (const test of tests) addReason(selected, repoPath(root, test), `unmapped requirement changed; fail-safe project selection: ${ids.join(', ')}`);
      }
    }

    if (projectChangedFiles.length > 0 && selected.size === 0) {
      const unresolved = projectChangedFiles.slice(0, 3).join(', ');
      const reason = `unresolved project change; fail-safe project selection: ${unresolved}${projectChangedFiles.length > 3 ? '…' : ''}`;
      for (const test of tests) addReason(selected, repoPath(root, test), reason);
    }
  }

  const selectedTests = [...selected.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([file, reasons]) => {
    const absolute = path.join(root, file);
    const text = testText.get(file) ?? (fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : '');
    const requirements = requirementTags(text);
    return { file, reasons: [...reasons].sort(), requirements, critical: /@critical\b/i.test(text) };
  });
  const requirements = unique(selectedTests.flatMap(test => test.requirements));
  const allProjectSelected = selectedTests.length === tests.length && tests.length > 0 && selectedTests.some(item => item.reasons.some(reason => /shared framework|project-wide|unmapped requirement|unresolved project change/.test(reason)));
  const selectionMode: ChangeImpactResult['selectionMode'] = allProjectSelected
    ? 'all-project-tests'
    : selectedTests.length
      ? 'targeted'
      : 'no-tests';

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    application: input.application,
    changedFiles,
    projectChangedFiles,
    frameworkChangedFiles,
    selectedTests,
    requirements,
    selectionMode,
    caveats: [
      'Impact analysis is advisory in v1.6.0; it does not silently skip the normal CI suite.',
      'Dynamic imports, runtime routing and external service changes may require broader execution than static import evidence can infer.',
      'Shared framework/config changes intentionally select all tests for the chosen application.'
    ]
  };
}

function buildDependencyGraph(root: string, files: string[]): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const dependencies: string[] = [];
    const rx = /(?:from\s+|import\s*\()(['"])(\.{1,2}\/[^'"]+)\1/g;
    for (const match of text.matchAll(rx)) {
      const resolved = resolveImport(file, match[2]);
      if (resolved) dependencies.push(repoPath(root, resolved));
    }
    graph.set(repoPath(root, file), unique(dependencies));
  }
  return graph;
}

function resolveImport(fromFile: string, specifier: string): string | undefined {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const raw = base.endsWith('.js') ? base.slice(0, -3) : base;
  const candidates = [base, `${raw}.ts`, `${raw}.tsx`, path.join(raw, 'index.ts'), path.join(raw, 'index.tsx')];
  return candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
}

function dependsOn(graph: Map<string, string[]>, test: string, changed: string): boolean {
  const stack = [test];
  const seen = new Set<string>();
  while (stack.length) {
    const current = stack.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);
    if (/\/fixtures\/[^/]+\.fixture\.(?:ts|tsx)$/.test(`/${current}`)) continue;
    for (const dependency of graph.get(current) ?? []) {
      if (dependency === changed) return true;
      stack.push(dependency);
    }
  }
  return false;
}

function requirementTags(text: string): string[] {
  return unique([...text.matchAll(/@requirement:([a-zA-Z0-9._-]+)/g)].map(match => match[1]));
}
function requirementFileIds(file: string): string[] {
  const base = path.basename(file).replace(/\.[^.]+$/, '');
  return unique([base]);
}
const GENERIC_FEATURE_HINT_TOKENS = new Set([
  'page', 'workflow', 'service', 'client', 'repository', 'spec', 'test', 'fixture', 'config', 'provider', 'facade',
  'data', 'helper', 'helpers', 'util', 'utils', 'common', 'shared', 'base', 'support', 'manager', 'model', 'models',
  'type', 'types', 'mapped', 'mapping', 'misc', 'general'
]);

function featureHints(file: string): string[] {
  const base = path.basename(file).toLowerCase().replace(/\.(?:ts|tsx|js|jsx|json|ya?ml|md)$/, '');
  const tokens = base.split(/[._-]+/).filter(token => token.length >= 4 && !GENERIC_FEATURE_HINT_TOKENS.has(token));
  return unique(tokens);
}
function isProjectWideChange(projectPrefix: string, file: string): boolean {
  const relative = file.startsWith(projectPrefix) ? file.slice(projectPrefix.length) : file;
  return relative === 'project.json' || relative === 'known-defects.json' || relative.startsWith('config/') || relative.startsWith('auth/') || relative.startsWith('data/') || relative.startsWith('fixtures/');
}
function isSharedConfig(file: string): boolean {
  return file === 'playwright.config.ts' || file === 'package.json' || file === 'package-lock.json' || file.startsWith('config/') || file.startsWith('scripts/test-project');
}
function addReason(selected: Map<string, Set<string>>, file: string, reason: string): void {
  const reasons = selected.get(file) ?? new Set<string>();
  reasons.add(reason);
  selected.set(file, reasons);
}
function collectFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const result: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', 'reports', 'test-results', '.git'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full); else result.push(full);
    }
  };
  walk(root);
  return result.sort();
}
function normalizeRepoPath(root: string, file: string): string {
  const absolute = path.isAbsolute(file) ? file : path.resolve(root, file);
  return repoPath(root, absolute);
}
function repoPath(root: string, file: string): string { return path.relative(root, file).split(path.sep).join('/'); }
function unique(values: string[]): string[] { return [...new Set(values.filter(Boolean))].sort(); }
