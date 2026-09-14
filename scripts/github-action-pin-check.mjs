import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const workflowDir = path.join(root, '.github', 'workflows');
const issues = [];
if (fs.existsSync(workflowDir)) {
  for (const name of fs.readdirSync(workflowDir).filter(file => /\.ya?ml$/i.test(file)).sort()) {
    const file = path.join(workflowDir, name);
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      const match = line.match(/^\s*-?\s*uses:\s*([^\s#]+)/);
      if (!match) return;
      const ref = match[1];
      if (ref.startsWith('./')) return;
      const at = ref.lastIndexOf('@');
      const revision = at >= 0 ? ref.slice(at + 1) : '';
      if (!/^[0-9a-f]{40}$/i.test(revision)) issues.push(`${path.relative(root, file)}:${index + 1}: external action must be pinned to a reviewed 40-char commit SHA: ${ref}`);
    });
  }
}
if (issues.length) { console.error(JSON.stringify({ ok: false, issues }, null, 2)); process.exit(1); }
console.log(JSON.stringify({ ok: true, policy: 'all external GitHub Actions pinned to full commit SHAs' }, null, 2));
