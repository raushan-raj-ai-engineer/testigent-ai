import { test, expect } from '../../fixtures/test.fixture';
import { LoginDataSchema } from '../../../../src/framework/data/schemas/login.schema';

test('framework reads JSON CSV Excel and YAML data @data', async ({ data }) => {
  await test.step('Load and validate structured JSON test data', async () => {
    const users = await data.load<any>('projects/demo/data/samples/json/users.json');
    expect(LoginDataSchema.parse(users.validUser).username).toBe('demo.user');
  });
  await test.step('Load tabular CSV test data', async () => {
    const users = await data.load<any[]>('projects/demo/data/samples/csv/users.csv');
    expect(users.length).toBeGreaterThan(0);
  });
  await test.step('Load business-owned Excel test data', async () => {
    const users = await data.load<any[]>('projects/demo/data/samples/excel/users.xlsx');
    expect(users[0].username).toBeTruthy();
  });
  await test.step('Load human-readable YAML test data', async () => {
    const orders = await data.load<any>('projects/demo/data/samples/yaml/orders.yaml');
    expect(orders.orders.length).toBeGreaterThan(0);
  });
});
