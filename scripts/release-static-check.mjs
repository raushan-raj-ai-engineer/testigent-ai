import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const issues = [];
const ignored = new Set(['node_modules', '.git', 'reports', 'test-results']);

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full)); else out.push(full);
  }
  return out;
}

for (const obsolete of ['src/applications', 'requirements', 'test-data', 'generated', 'specs', 'PATCH-README.md', 'tsconfig.json.bak', '.upgrade-backup']) {
  if (fs.existsSync(path.join(root, obsolete))) issues.push(`obsolete release path: ${obsolete}`);
}

for (const file of walk(path.join(root, 'src', 'framework')).filter(f => f.endsWith('.ts'))) {
  const text = fs.readFileSync(file, 'utf8');
  if (/from\s+['"][^'"]*projects\//.test(text)) issues.push(`framework imports project: ${path.relative(root, file)}`);
}

for (const file of walk(root).filter(f => /\.(?:ts|tsx|js|mjs|cjs)$/.test(f))) {
  if (path.basename(file) === 'release-static-check.mjs') continue;
  const text = fs.readFileSync(file, 'utf8');
  const legacyReporting = 'src/' + 'reporting/';
  if (text.includes(legacyReporting)) issues.push(`legacy reporting path reference: ${path.relative(root, file)}`);
  if (/\.(?:ts|tsx)$/.test(file) && text.includes('import.meta')) issues.push(`CommonJS-incompatible import.meta usage: ${path.relative(root, file)}`);
}

for (const project of fs.readdirSync(path.join(root, 'projects'), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name)) {
  for (const needed of [`projects/${project}/config`, `projects/${project}/fixtures/test.fixture.ts`, `projects/${project}/tests`]) {
    if (!fs.existsSync(path.join(root, needed))) issues.push(`project contract missing: ${needed}`);
  }
}


// Provider-neutral AI release contracts.
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const genericAiScript = pkg.scripts?.['test:ai-healing'] ?? '';
  if (/AI_PROVIDER=/.test(genericAiScript)) issues.push('generic test:ai-healing must not hardcode an AI provider');
  if (!pkg.scripts?.['test:ai-healing:ollama']) issues.push('missing explicit Ollama AI-healing example script');
  if (!pkg.scripts?.['test:ai-healing:gemini']) issues.push('missing explicit Gemini AI-healing example script');
} catch (error) {
  issues.push(`unable to validate package AI scripts: ${error.message}`);
}


for (const required of [
  'docs/14-ROOT-FOLDERS-AND-LOCAL-STATE.md',
  'docs/15-NEW-PROJECT-HANDOFF.md',
  'docs/16-PLAYWRIGHT-AGENTS-PRODUCTIVITY.md',
  'docs/17-DEEP-REVIEW-2026.md',
  'scripts/harden-agent-definitions.ts',
  'scripts/authoring-productivity.ts',
  'src/framework/ai/ai.audit.ts'
]) {
  if (!fs.existsSync(path.join(root, required))) issues.push(`required deep-review artifact missing: ${required}`);
}

try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (!pkg.scripts?.['agents:init']) issues.push('missing generic agents:init script');
  if (!pkg.scripts?.['agents:policy']) issues.push('missing agent enterprise-policy script');
  if (!pkg.scripts?.['authoring:report']) issues.push('missing authoring productivity report script');
  if (!pkg.scripts?.['mcp:start']?.includes('start-mcp.ts')) issues.push('mcp:start must use env-driven start-mcp.ts wrapper');
} catch (error) {
  issues.push(`unable to validate deep-review scripts: ${error.message}`);
}

const githubAgents = path.join(root, '.github', 'agents');
if (fs.existsSync(githubAgents)) {
  for (const file of walk(githubAgents).filter(f => f.endsWith('.md'))) {
    const text = fs.readFileSync(file, 'utf8');
    if (/^model:\s*.+$/m.test(text)) issues.push(`repository agent pins a model instead of user/client choice: ${path.relative(root, file)}`);
    if (!text.includes('ENTERPRISE PLAYWRIGHT FRAMEWORK OVERLAY')) issues.push(`repository agent missing enterprise overlay: ${path.relative(root, file)}`);
  }
}

const envExamplePath = path.join(root, '.env.example');
if (fs.existsSync(envExamplePath)) {
  const envExample = fs.readFileSync(envExamplePath, 'utf8');
  if (/^AI_PROVIDER=(?!\s*$).+/m.test(envExample)) issues.push('.env.example must not impose a default AI provider');
  if (!/^AI_PROVIDER_MODE=single$/m.test(envExample)) issues.push('.env.example must document single as the safe provider-selection mode');
}

const todoPagePath = path.join(root, 'projects', 'demo', 'src', 'pages', 'todo.page.ts');
if (fs.existsSync(todoPagePath)) {
  const todoPage = fs.readFileSync(todoPagePath, 'utf8');
  if (!todoPage.includes("navigate('/todomvc/')")) issues.push('demo Todo page must navigate to /todomvc/');
}

for (const file of walk(root).filter(f => f.endsWith('.json'))) {
  try { JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { issues.push(`invalid JSON ${path.relative(root, file)}: ${error.message}`); }
}

for (const file of walk(root).filter(f => f.endsWith('.ts'))) {
  const text = fs.readFileSync(file, 'utf8');
  const rx = /(?:from\s+|import\s*\()(['"])(\.{1,2}\/[^'"]+)\1/g;
  for (const match of text.matchAll(rx)) {
    const spec = match[2];
    const base = path.resolve(path.dirname(file), spec);
    const raw = base.endsWith('.js') ? base.slice(0, -3) : base;
    const candidates = [base, `${raw}.ts`, `${raw}.tsx`, path.join(raw, 'index.ts')];
    if (!candidates.some(fs.existsSync)) issues.push(`unresolved internal import ${path.relative(root, file)} -> ${spec}`);
  }
}

if (issues.length) {
  console.error(JSON.stringify({ ok: false, issues }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, projects: fs.readdirSync(path.join(root, 'projects')).sort(), filesChecked: walk(root).length }, null, 2));
