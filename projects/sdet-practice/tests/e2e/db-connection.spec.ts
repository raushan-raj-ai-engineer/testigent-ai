import { expect, test } from '../../fixtures/test.fixture';

test('database connection works @db', async ({ repositories }) => {
  await test.step('Verify configured database responds', async () => {
    expect(await repositories.healthCheck()).toBeTruthy();
  });
});
