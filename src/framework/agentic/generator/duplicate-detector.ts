import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry: { name: string; isDirectory(): boolean }) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

/** Detects exact target/content duplication before an agentic generation proposal is considered for review. */
export function detectGenerationDuplicate(root: string, project: string, targetPath: string, content: string): { duplicate: boolean; reason?: string } {
  const absoluteTarget = path.resolve(root, targetPath);
  if (fs.existsSync(absoluteTarget)) return { duplicate: true, reason: `Target already exists: ${targetPath}` };
  const digest = createHash('sha256').update(content).digest('hex');
  const projectRoot = path.resolve(root, 'projects', project);
  for (const file of walk(projectRoot).filter(candidate => /\.(?:ts|tsx|js|mjs|cjs|json|ya?ml)$/i.test(candidate))) {
    try {
      if (createHash('sha256').update(fs.readFileSync(file)).digest('hex') === digest) {
        return { duplicate: true, reason: `Equivalent content already exists at ${path.relative(root, file).replaceAll('\\', '/')}.` };
      }
    } catch { /* unreadable project artifacts are ignored by duplicate discovery */ }
  }
  return { duplicate: false };
}
