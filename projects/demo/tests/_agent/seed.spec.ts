import { test } from '../../fixtures/test.fixture';

/** Playwright Test Agent seed using the same facade/fixture boundary as production tests. */
test.skip(
  process.env.RUN_EXTERNAL_TESTS !== 'true',
  'External public demo dependency; run with npm run test:external.',
);

test('demo agent seed @framework @agent-seed @external', async ({ app }) => {
  await app.todo.open();
});
