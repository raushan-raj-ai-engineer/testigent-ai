/** CLI: build normalized review-first test plan. Author: Raushan Raj */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadRequirement } from '../src/framework/intelligence/adapters/source.factory.js';
import { analyzeRequirement } from '../src/framework/intelligence/knowledge/analyzer.js';
import { buildTestPlan } from '../src/framework/intelligence/generation/test-plan.js';

async function main(): Promise<void> {
  const source = process.argv[2];
  if (!source) throw new Error('Usage: npm run requirement:test-plan -- <source>');

  const root = process.cwd();
  const requirement = await loadRequirement(source);
  const analysis = await analyzeRequirement(root, requirement);
  const plan = buildTestPlan(analysis);
  const directory = join(root, 'generated', 'requirements', requirement.sourceId);
  await mkdir(directory, { recursive: true });

  const outputPath = join(directory, 'test-plan.json');
  await writeFile(outputPath, JSON.stringify(plan, null, 2));
  console.log(`Test plan written: ${outputPath}`);
  console.log(JSON.stringify(plan, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
