import { test, expect } from '../../src/framework/core/fixtures/enterprise.fixture';

/**
 * Author: Raushan Raj
 * Business Use: Demonstrates Playwright 1.63 test locks for a resource that must not be mutated concurrently.
 * How to use: Give tests touching the same non-parallel-safe account/resource the same lock name.
 * Benefit: Keeps the rest of the suite parallel while serializing only the truly shared resource.
 */
test('update shared enterprise setting @parallel', { lock: 'shared-enterprise-setting' }, async () => {
  await test.step('Use the protected shared resource', async () => {
    expect(true).toBeTruthy();
  });
});
