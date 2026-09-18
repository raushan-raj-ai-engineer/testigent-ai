import path from 'node:path';
import { test } from '../../fixtures/test.fixture';
import { discoverDeclarativeScenarios } from '../../../../src/framework/declarative/scenario.discovery';
import { runDeclarativeScenario } from '../../../../src/framework/declarative/scenario.runner';
import { WorkspaceContext } from '../../../../src/framework/core/config/workspace.context';

// Framework capability suite: scenarios are discovered for the same selected project as the Playwright runtime.
const application = WorkspaceContext.resolve().application;
const scenarios = discoverDeclarativeScenarios(application);

test.skip(
  process.env.RUN_EXTERNAL_TESTS !== 'true',
  'External public demo dependency; run with npm run test:external.',
);

test.describe('Governed declarative UI scenarios', () => {
  for (const { filePath, scenario } of scenarios) {
    const tags = uniqueTags(['@declarative', '@ui', '@lane:ui', ...scenario.tags]);
    test(
      `${scenario.title} @scenario:${scenario.id} ${tags.join(' ')}`,
      { annotation: [{ type: 'scenarioId', description: scenario.id }, { type: 'scenarioFile', description: path.relative(process.cwd(), filePath) }] },
      async ({ page }) => {
        await runDeclarativeScenario(page, scenario);
      },
    );
  }
});

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags)];
}
