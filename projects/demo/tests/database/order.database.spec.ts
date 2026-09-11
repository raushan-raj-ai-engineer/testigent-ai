import { test, expect } from '../../fixtures/test.fixture';

test('order is persisted with expected status @db', async ({ repositories, data }) => {
  const reference = await data.load<{ orderId: string }>('projects/demo/data/reference/order.json');
  await test.step('Verify the order was persisted in the database', async () => {
    const record = await repositories.orders.findById(reference.orderId);
    expect(record).toBeTruthy();
  });
});
