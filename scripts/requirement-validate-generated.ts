/** CLI: safety/structure validation of generated proposals. Author: Raushan Raj */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function walk(directory: string, output: string[] = []): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return output;
  }

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path, output);
    else if (path.endsWith('.generated.spec.ts') || /\.(?:page|workflow|service|repository)\.ts$/.test(path)) output.push(path);
  }
  return output;
}

async function main(): Promise<void> {
  const files = await walk(process.cwd());
  const loaded = await Promise.all(files.map(async path => ({ path, text: await readFile(path, 'utf8') })));
  const generated = loaded.filter(item => item.path.endsWith('.generated.spec.ts') || item.text.includes('GENERATED PROPOSAL'));

  let errors = 0;
  for (const { path, text } of generated) {
    if (!text.includes('REVIEW_REQUIRED') || !text.includes('Author: Raushan Raj')) {
      console.error(`Missing review/author marker: ${path}`);
      errors++;
    }
    if (/page\.locator\(['"][#.]/.test(text)) {
      console.error(`Raw CSS/id locator found in generated proposal: ${path}`);
      errors++;
    }
  }

  if (errors) {
    process.exitCode = 1;
    return;
  }
  console.log(`Generated proposal validation passed (${generated.length} candidate files checked).`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
