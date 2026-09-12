import { test, expect } from '../../src/framework/core/fixtures/enterprise.fixture';

/** This suite must pass on a worker where Playwright browser binaries are not installed. */
test.describe('Browser-free enterprise fixtures', () => {
  test('API/data/DB fixture graph does not request browser or context', async ({ apiClient, data, dataScope, db, runtime }) => {
    expect(apiClient).toBeDefined();
    expect(data).toBeDefined();
    expect(dataScope).toBeDefined();
    expect(db).toBeDefined();
    expect(runtime.applicationName).toBeTruthy();
  });
});
