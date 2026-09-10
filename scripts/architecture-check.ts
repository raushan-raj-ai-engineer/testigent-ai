import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const issues: string[] = [];
const projectsRoot = path.join(root, 'projects');
const projects = fs.existsSync(projectsRoot)
  ? fs.readdirSync(projectsRoot, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort()
  : [];

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', 'reports', 'test-results', 'dist'].includes(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

for (const file of walk(path.join(root, 'src', 'framework')).filter(f => /\.(ts|js)$/.test(f))) {
  const text = fs.readFileSync(file, 'utf8');
  if (/from\s+['"][^'"]*projects\//.test(text) || /from\s+['"][^'"]*applications\//.test(text)) {
    issues.push(`Reusable framework imports project code: ${path.relative(root, file)}`);
  }
}

for (const project of projects) {
  const configDir = path.join(projectsRoot, project, 'config');
  if (!fs.existsSync(configDir) || !fs.readdirSync(configDir).some(f => f.endsWith('.json'))) issues.push(`Project has no environment config: ${project}`);
  if (!fs.existsSync(path.join(projectsRoot, project, 'fixtures', 'test.fixture.ts'))) issues.push(`Project has no fixture: ${project}`);
  for (const file of walk(path.join(projectsRoot, project)).filter(f => /\.(ts|js)$/.test(f))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const sibling of projects.filter(p => p !== project)) {
      if (text.includes(`projects/${sibling}/`) || text.includes(`../${sibling}/`)) issues.push(`Project '${project}' references sibling '${sibling}': ${path.relative(root, file)}`);
    }
  }
}

for (const obsolete of ['src/applications', 'requirements', 'test-data', 'tsconfig.json.bak', 'PATCH-README.md', '.upgrade-backup']) {
  if (fs.existsSync(path.join(root, obsolete))) issues.push(`Legacy/obsolete path exists: ${obsolete}`);
}

for (const file of walk(root)) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  if (/\.bak(?:\.|$)|\.before-|backup-hotfix|backup-permanent/.test(rel)) issues.push(`Backup artifact should not ship: ${rel}`);
}

console.log(JSON.stringify({ ok: issues.length === 0, projects, issues }, null, 2));
if (issues.length) process.exitCode = 1;
