import { test } from '../../fixtures/test.fixture';

/** Playwright Test Agent seed using project authentication and domain fixtures. */
test('sdet-practice agent seed @framework @agent-seed', async ({ app }) => {
  await app.userManagement.open();
});
