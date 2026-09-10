/** CLI: generate architecture-aware code proposal. Author: Raushan Raj */
import { intelligenceFlags } from '../src/framework/intelligence/core/flags.js';
import { loadRequirement } from '../src/framework/intelligence/adapters/source.factory.js';
import { analyzeRequirement } from '../src/framework/intelligence/knowledge/analyzer.js';
import { generateFrameworkProposal } from '../src/framework/intelligence/generation/framework.generator.js';

async function main(): Promise<void> {
  if (!intelligenceFlags.generationEnabled()) {
    throw new Error('TEST_GENERATION_ENABLED is false. Enable it explicitly for generation.');
  }

  const source = process.argv[2];
  if (!source) {
    throw new Error('Usage: TEST_GENERATION_ENABLED=true npm run requirement:generate -- <source>');
  }

  const root = process.cwd();
  const requirement = await loadRequirement(source);
  const analysis = await analyzeRequirement(root, requirement);
  if (analysis.readiness === 'BLOCKED') {
    const reasons = [...analysis.missingInformation, ...analysis.conflicts];
    throw new Error(`Generation blocked: ${reasons.join('; ')}`);
  }

  const output = await generateFrameworkProposal(root, analysis);
  console.log(JSON.stringify(output, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
