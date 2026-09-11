import { test } from '../../fixtures/test.fixture';

/** Playwright Test Agent seed using the same facade/fixture boundary as production tests. */
test('demo agent seed @framework @agent-seed', async ({ app }) => {
  await app.todo.open();
});
