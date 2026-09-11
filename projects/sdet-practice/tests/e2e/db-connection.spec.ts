import { expect, test } from '../../fixtures/test.fixture';

test('database connection works @db', async ({ db }) => {
    const result = await db.query('SELECT 1 AS ok');

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].ok).toBe(1);
});