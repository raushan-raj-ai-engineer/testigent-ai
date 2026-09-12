import { test } from '../../fixtures/test.fixture';

/**
 * Playwright Test Agent seed: initializes project configuration, authentication, fixtures and hooks.
 * Agents should use this as the architectural example and keep generated business specs facade-first.
 */
test('__PROJECT__ agent seed @framework @agent-seed', async ({ app }) => {
  await app.home.open();
});
