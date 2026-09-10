import { test, expect } from '../../fixtures/test.fixture';

test('retrieve customer details through API @smoke @api', async ({ api }) => {
  await test.step('Retrieve an existing customer from the service', async () => {
    const user = await api.users.getUser(1);
    expect(user.id).toBe(1);
    expect(user.email).toBeTruthy();
  });
});
