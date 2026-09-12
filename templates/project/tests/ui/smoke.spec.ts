import { test } from '../../fixtures/test.fixture';

test('__PROJECT__ is reachable @smoke @ui', async ({ app }) => {
  await test.step('Open the application', async () => { await app.home.open(); });
  await test.step('Verify the application is ready', async () => { await app.home.verifyReady(); });
});
