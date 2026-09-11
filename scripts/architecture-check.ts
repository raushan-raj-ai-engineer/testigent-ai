import fs from 'node:fs';
import path from 'node:path';

interface SpecException { path: string; rules: string[]; reason: string; }
interface ArchitecturePolicy { version: number; specExceptions: SpecException[]; }

const root = process.cwd();
const issues: string[] = [];
const projectsRoot = path.join(root, 'projects');
const projects = fs.existsSync(projectsRoot)
  ? fs.readdirSync(projectsRoot, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort()
  : [];
const policy = readPolicy();
const exceptions = new Map(policy.specExceptions.map(item => [normalize(item.path), item]));

const forbiddenSpecPatterns: Array<{ rule: string; pattern: RegExp; description: string }> = [
  { rule: 'raw-playwright-ui', pattern: /\bpage\.(?:goto|locator|getByRole|getByText|getByLabel|getByPlaceholder|getByTestId|click|fill|press|check|uncheck|selectOption)\s*\(/, description: 'raw Playwright UI action' },
  { rule: 'direct-healer', pattern: /new\s+HealingOrchestrator\s*\(/, description: 'direct HealingOrchestrator construction' },
  { rule: 'direct-ai-gateway', pattern: /createAiGateway\s*\(/, description: 'direct AI gateway construction' },
  { rule: 'direct-api-client', pattern: /new\s+BaseApiClient\s*\(/, description: 'direct BaseApiClient construction' },
  { rule: 'direct-registry', pattern: /ApplicationRegistry\.current\s*\(/, description: 'direct ApplicationRegistry runtime access' },
  { rule: 'direct-database-factory', pattern: /DatabaseFactory(?:\.|\s*\()/, description: 'direct DatabaseFactory access' },
  { rule: 'direct-runtime-target-env', pattern: /process\.env\.(?:APP|ENV)\b/, description: 'direct APP/ENV environment read' },
  { rule: 'direct-database-env', pattern: /process\.env\.DB_(?:TYPE|HOST|PORT|NAME|USER|PASSWORD|SSL)\b/, description: 'direct database environment read' },
  { rule: 'absolute-url', pattern: /https?:\/\//i, description: 'absolute URL' },
  { rule: 'literal-secret', pattern: /\b(?:password|token|apiKey|secret)\s*:\s*['"][^'"]+['"]/i, description: 'literal secret/credential-like value' },
];

function readPolicy(): ArchitecturePolicy {
  const file = path.join(root, 'config', 'architecture.json');
  if (!fs.existsSync(file)) return { version: 1, specExceptions: [] };
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<ArchitecturePolicy>;
  if (parsed.version !== 1 || !Array.isArray(parsed.specExceptions)) {
    throw new Error(`Invalid architecture policy: ${path.relative(root, file)}`);
  }
  return { version: 1, specExceptions: parsed.specExceptions };
}

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'reports', 'test-results', 'dist', '.git'].includes(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

function normalize(value: string): string { return value.replaceAll('\\', '/'); }
function rel(file: string): string { return normalize(path.relative(root, file)); }
function isAllowed(relative: string, rule: string): boolean { return exceptions.get(relative)?.rules.includes(rule) ?? false; }

for (const exception of policy.specExceptions) {
  const relative = normalize(exception.path);
  if (!exception.reason?.trim()) issues.push(`Architecture exception has no reason: ${relative}`);
  if (!exception.rules?.length) issues.push(`Architecture exception has no allowed rules: ${relative}`);
  if (!fs.existsSync(path.join(root, relative))) issues.push(`Architecture exception points to a missing file: ${relative}`);
  const knownRules = new Set(forbiddenSpecPatterns.map(item => item.rule));
  for (const rule of exception.rules ?? []) if (!knownRules.has(rule)) issues.push(`Architecture exception uses unknown rule '${rule}': ${relative}`);
}

for (const file of walk(path.join(root, 'src', 'framework')).filter(f => /\.(ts|js)$/.test(f))) {
  const text = fs.readFileSync(file, 'utf8');
  if (/from\s+['"][^'"]*projects\//.test(text) || /from\s+['"][^'"]*applications\//.test(text)) {
    issues.push(`Reusable framework imports project code: ${rel(file)}`);
  }
}

for (const project of projects) {
  const projectRoot = path.join(projectsRoot, project);
  const configDir = path.join(projectRoot, 'config');
  const requiredContract = [
    path.join(projectRoot, 'project.json'),
    path.join(projectRoot, 'fixtures', 'test.fixture.ts'),
    path.join(projectRoot, 'src', 'app.facade.ts'),
    path.join(projectRoot, 'tests', '_agent', 'seed.spec.ts'),
  ];

  if (!fs.existsSync(configDir) || !fs.readdirSync(configDir).some(f => f.endsWith('.json'))) issues.push(`Project has no environment config: ${project}`);
  for (const required of requiredContract) if (!fs.existsSync(required)) issues.push(`Project contract file missing: ${rel(required)}`);

  for (const file of walk(projectRoot).filter(f => /\.(ts|js)$/.test(f))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const sibling of projects.filter(p => p !== project)) {
      if (text.includes(`projects/${sibling}/`) || text.includes(`../${sibling}/`)) issues.push(`Project '${project}' references sibling '${sibling}': ${rel(file)}`);
    }
    if (/https?:\/\//i.test(text) && !rel(file).includes('/tests/')) {
      issues.push(`Project source contains an absolute URL; move environment-dependent URLs to config: ${rel(file)}`);
    }
  }

  for (const file of walk(path.join(projectRoot, 'tests')).filter(f => /\.spec\.(ts|js)$/.test(f))) {
    const relative = rel(file);
    const text = fs.readFileSync(file, 'utf8');
    for (const rule of forbiddenSpecPatterns) {
      if (rule.pattern.test(text) && !isAllowed(relative, rule.rule)) {
        issues.push(`Project spec bypasses authoring contract (${rule.description}): ${relative}`);
      }
    }
  }
}

for (const obsolete of ['src/applications', 'requirements', 'test-data', 'tsconfig.json.bak', 'PATCH-README.md', '.upgrade-backup']) {
  if (fs.existsSync(path.join(root, obsolete))) issues.push(`Legacy/obsolete path exists: ${obsolete}`);
}

for (const file of walk(root)) {
  const relative = rel(file);
  if (/\.bak(?:\.|$)|\.before-|backup-hotfix|backup-permanent/.test(relative)) issues.push(`Backup artifact should not ship: ${relative}`);
}

console.log(JSON.stringify({
  ok: issues.length === 0,
  projects,
  configuredExceptions: policy.specExceptions.map(item => ({ path: item.path, rules: item.rules, reason: item.reason })),
  issues,
}, null, 2));
if (issues.length) process.exitCode = 1;
