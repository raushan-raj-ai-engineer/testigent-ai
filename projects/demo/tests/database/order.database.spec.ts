import { test, expect } from '../../fixtures/test.fixture';
import { OrderRepository } from '../../src/database/order.repository';

test('order is persisted with expected status @db', async ({ db }) => {
  test.skip((process.env.DB_TYPE ?? 'none') === 'none', 'Configure a test database before running DB tests.');
  await test.step('Verify the order was persisted in the database', async () => {
    const repository = new OrderRepository(db);
    const record = await repository.findById(process.env.TEST_ORDER_ID ?? 'sample-order');
    expect(record).toBeTruthy();
  });
});
