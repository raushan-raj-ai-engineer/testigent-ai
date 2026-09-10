import { test, expect } from '../../fixtures/test.fixture';
import { OrderRepository } from '../../src/database/order.repository';

/**
 * Author: Raushan Raj
 * Business Use: Illustrates UI + API + DB validation in one business scenario.
 * How to use: Replace demo calls with real product workflow/service/repository and enable DB.
 * Benefit: End-to-end confidence while keeping each technical layer reusable and independently testable.
 */
test('customer journey can be validated across UI API and DB @e2e', async ({ app, api, db }, testInfo) => {
  test.skip((process.env.DB_TYPE ?? 'none') === 'none', 'Reference E2E requires a configured database.');
  const unique = `${testInfo.parallelIndex}-${Date.now()}`;

  await test.step('Customer creates a work item in the user interface', async () => {
    await app.todo.addTodoAndVerify(`E2E-${unique}`);
  });

  await test.step('Validate related customer service is available', async () => {
    const user = await api.users.getUser(1);
    expect(user.id).toBe(1);
  });

  await test.step('Validate the business record in the database', async () => {
    const repository = new OrderRepository(db);
    const record = await repository.findById(process.env.TEST_ORDER_ID ?? 'sample-order');
    expect(record).toBeTruthy();
  });
});
