import { test } from '../../fixtures/test.fixture';
import { loadDeclarativeScenario } from '../../../../src/framework/declarative/scenario.loader';
import { runDeclarativeScenario } from '../../../../src/framework/declarative/scenario.runner';

test('manual tester can run governed YAML scenario @ui @lane:ui @smoke', async ({ page }) => {
  const scenario = loadDeclarativeScenario('projects/demo/data/scenarios/todo-smoke.yaml');
  await runDeclarativeScenario(page, scenario);
});
