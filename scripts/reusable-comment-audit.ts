import fs from 'node:fs';
import path from 'node:path';

/** Audits exported reusable functions/classes/constants for a nearby JSDoc contract. */
function main(): void {
  const root = path.resolve('src/framework');
  const files = walk(root).filter(file => file.endsWith('.ts'));
  const problems: string[] = [];
  let reusable = 0;
  const declaration = /^export\s+(?:async\s+)?(?:function|class|const)\s+([A-Za-z0-9_]+)/;
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const match = lines[index]!.match(declaration);
      if (!match) continue;
      reusable += 1;
      const previous = lines.slice(Math.max(0, index - 8), index).join('\n');
      if (!previous.includes('/**')) problems.push(`${path.relative(process.cwd(), file)}:${index + 1} ${match[1]}`);
    }
  }
  console.log(`Reusable export comment audit: ${reusable} declarations, ${problems.length} issues.`);
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exitCode = 1;
  }
}

function walk(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

main();
