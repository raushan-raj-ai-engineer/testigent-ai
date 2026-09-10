import fs from 'node:fs';
import path from 'node:path';

const name = process.argv[2]?.trim();
if (!name || !/^[a-z0-9][a-z0-9._-]*$/i.test(name)) {
  console.error('Usage: npm run project:new -- <project-name>');
  process.exit(1);
}
const root = process.cwd();
const source = path.join(root, 'templates', 'project');
const target = path.join(root, 'projects', name);
if (fs.existsSync(target)) {
  console.error(`Project already exists: ${target}`);
  process.exit(1);
}

function copyTree(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else {
      const raw = fs.readFileSync(src, 'utf8').replaceAll('__PROJECT__', name!);
      fs.writeFileSync(dst, raw);
    }
  }
}
copyTree(source, target);
console.log(`Created projects/${name}`);
console.log(`Next: update projects/${name}/config/qa.json, then APP=${name} ENV=qa npm run project:check`);
