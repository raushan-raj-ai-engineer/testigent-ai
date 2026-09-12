import { test, expect } from '../../fixtures/test.fixture';

/** Reference cross-layer scenario using only project domain facades from the test body. */
test('customer journey can be validated across UI API and DB @e2e @db', async ({ app, api, repositories, data }, testInfo) => {
  const unique = `${testInfo.parallelIndex}-${Date.now()}`;
  const reference = await data.load<{ orderId: string }>('projects/demo/data/reference/order.json');

  await test.step('Customer opens the work application and creates a work item', async () => {
    await app.todo.open();
    await app.todo.addTodoAndVerify(`E2E-${unique}`);
  });

  await test.step('Validate related customer service is available', async () => {
    const user = await api.users.getUser(1);
    expect(user.id).toBe(1);
  });

  await test.step('Validate the business record in the database', async () => {
    const record = await repositories.orders.findById(reference.orderId);
    expect(record).toBeTruthy();
  });
});
