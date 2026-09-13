import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const issues = [];
const checked = { json: 0, text: 0, required: 0 };
const ignoredDirs = new Set(['node_modules', '.git', 'reports', 'test-results', 'playwright-report', 'blob-report', '.runtime', '.auth', '.healing', '.report-history', 'coverage', 'dist']);
const forbiddenNames = new Set(['.env', '.DS_Store']);

function isGitIgnoredLocalFile(rel) {
  if (!fs.existsSync(path.join(root, '.git'))) return false;
  const result = spawnSync('git', ['check-ignore', '-q', '--', rel], { cwd: root, stdio: 'ignore' });
  return result.status === 0;
}
const required = [
  'package.json', 'package-lock.json', 'playwright.config.ts', 'config/organization.json',
  'src/framework/core/execution/execution.policy.ts', 'src/framework/data/data-scope.ts',
  'src/framework/data/data.factory.ts', 'src/framework/execution/duration-history.store.ts',
  'src/framework/evaluation/evaluation.runner.ts', 'scripts/scale-audit.ts',
  'docs/TestigentAI_Issue_Challenge_Solution_Log.docx',
  'docs/TestigentAI_Product_Architecture_and_Scale_Roadmap.docx',
  'docs/19-MARKET-COMPETITIVE-RESEARCH-2026.md', 'docs/22-COMPETITIVE-BENCHMARK-PLAN.md',
  'docs/23-DECLARATIVE-AUTHORING-DEEP-RESEARCH.md', 'docs/24-DECLARATIVE-AUTOMATION-GUIDE.md',
  'schemas/testigent-scenario.schema.json', 'scripts/scenario-authoring.ts',
  'docs/50-v1.7.0-AGENTIC-TEST-INTELLIGENCE.md', 'docs/52-v1.7.0-AGENTIC-MCP-GUIDE.md',
  'src/framework/agentic/policy/agentic-policy.ts', 'src/framework/agentic/evidence/agent-decision-ledger.ts',
  'src/framework/mcp/server.ts', 'src/framework/mcp/security-policy.ts',
  'tests/framework/agentic-policy-contract.spec.ts', 'tests/framework/agentic-mcp-contract.spec.ts',
];

function walk(dir) {
  const output = [];
  if (!fs.existsSync(dir)) return output;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...walk(full)); else output.push(full);
  }
  return output;
}

for (const file of required) {
  checked.required += 1;
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile() || fs.statSync(absolute).size === 0) issues.push(`required release artifact missing/empty: ${file}`);
}

const files = walk(root);
for (const file of files) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  const base = path.basename(file);
  if (forbiddenNames.has(base) && !isGitIgnoredLocalFile(rel)) issues.push(`forbidden local/runtime file included: ${rel}`);
  if (forbiddenNames.has(base) && isGitIgnoredLocalFile(rel)) continue;
  if (base.endsWith('.bak') || base.includes('.before-')) issues.push(`backup artifact included: ${rel}`);

  if (file.endsWith('.json')) {
    checked.json += 1;
    try { JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (error) { issues.push(`invalid JSON ${rel}: ${error instanceof Error ? error.message : String(error)}`); }
  }

  if (!/\.(?:ts|tsx|js|mjs|cjs|json|ya?ml|md|txt|sh|example)$/i.test(file)) continue;
  checked.text += 1;
  const text = fs.readFileSync(file, 'utf8');
  const secretPatterns = [
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key block'],
    [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
    [/\bgh[pousr]_[A-Za-z0-9_]{30,}\b/, 'GitHub token'],
    [/\bAIza[0-9A-Za-z_-]{30,}\b/, 'Google API key'],
    [/\bsk-[A-Za-z0-9_-]{24,}\b/, 'OpenAI-style secret key'],
    [/\b(?:password|passwd|api[_-]?key|secret|token)\s*[:=]\s*["'](?!<|\$\{|process\.env|REDACTED|placeholder|example)[^"'\n]{12,}["']/i, 'hard-coded credential-like value'],
  ];
  for (const [rx, label] of secretPatterns) if (rx.test(text)) issues.push(`${label} pattern in ${rel}`);
}

try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  for (const [group, entries] of Object.entries({ dependencies: pkg.dependencies ?? {}, devDependencies: pkg.devDependencies ?? {} })) {
    for (const [name, value] of Object.entries(entries)) {
      const spec = String(value);
      if (spec === 'latest' || /^[~^*]/.test(spec)) issues.push(`floating dependency: ${group}.${name}=${spec}`);
    }
  }
  if (!pkg.engines?.node) issues.push('package.json must declare engines.node');
} catch (error) { issues.push(`package.json validation failed: ${error instanceof Error ? error.message : String(error)}`); }

try {
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  if (![2, 3].includes(lock.lockfileVersion)) issues.push(`unsupported package-lock lockfileVersion: ${lock.lockfileVersion}`);
  const rootPkg = lock.packages?.[''];
  if (!rootPkg) issues.push('package-lock is missing the root package entry');
} catch (error) { issues.push(`package-lock validation failed: ${error instanceof Error ? error.message : String(error)}`); }

const digest = crypto.createHash('sha256')
  .update(files.filter(f => !ignoredDirs.has(path.basename(path.dirname(f)))).map(f => path.relative(root, f).replace(/\\/g, '/')).sort().join('\n'))
  .digest('hex');

if (issues.length) {
  console.error(JSON.stringify({ ok: false, issues, checked }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, checked, files: files.length, inventoryDigest: digest }, null, 2));
