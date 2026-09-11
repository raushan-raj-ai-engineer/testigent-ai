import { test, expect } from '../../fixtures/test.fixture';
import { captureWebPerformance, validateWebPerformanceBudget } from '../../../../src/framework/quality/performance.budget';

test('TodoMVC lightweight performance budget @performance @lane:performance', async ({ app, page }) => {
  await app.todo.open();
  const snapshot = await captureWebPerformance(page);
  const violations = validateWebPerformanceBudget(snapshot, { loadMs: 10_000, resourceCount: 100 });
  expect(violations).toEqual([]);
});
