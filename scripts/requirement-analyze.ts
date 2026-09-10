/** CLI: analyze any supported requirement source. Author: Raushan Raj */
import { loadRequirement } from '../src/framework/intelligence/adapters/source.factory.js';
import { analyzeRequirement } from '../src/framework/intelligence/knowledge/analyzer.js';

async function main(): Promise<void> {
  const source = process.argv[2];
  if (!source) {
    throw new Error('Usage: npm run requirement:analyze -- <file|JIRA:id|AZURE:id|GITHUB:id>');
  }

  const root = process.cwd();
  const requirement = await loadRequirement(source);
  const analysis = await analyzeRequirement(root, requirement);

  console.log(JSON.stringify(analysis, null, 2));
  if (analysis.readiness === 'BLOCKED') process.exitCode = 2;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
