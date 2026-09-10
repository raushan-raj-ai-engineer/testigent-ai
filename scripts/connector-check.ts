/** CLI: verify an external requirement source by reading one ticket without exposing raw payloads. Author: Raushan Raj */
import { loadRequirement } from '../src/framework/intelligence/adapters/source.factory.js';

async function main(): Promise<void> {
  const source = process.argv[2];
  if (!source) {
    throw new Error('Usage: npm run connector:check -- JIRA:PAY-142 | AZURE:123 | GITHUB:123 | GITHUB:owner/repo#123 | <issue-url>');
  }

  const requirement = await loadRequirement(source);
  console.log(JSON.stringify({
    ok: true,
    sourceType: requirement.sourceType,
    sourceId: requirement.sourceId,
    title: requirement.title,
    feature: requirement.feature,
    priority: requirement.priority,
    acceptanceCriteriaCount: requirement.acceptanceCriteria.length,
    manualTestStepsCount: requirement.manualTestSteps.length,
    expectedResultsCount: requirement.expectedResults.length,
    tags: requirement.tags,
    links: requirement.links
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
