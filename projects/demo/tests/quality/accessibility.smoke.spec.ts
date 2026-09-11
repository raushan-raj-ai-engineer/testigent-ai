import { test, expect } from '../../fixtures/test.fixture';
import { runAccessibilitySmoke } from '../../../../src/framework/quality/accessibility.smoke';

test('TodoMVC accessibility smoke @accessibility @lane:accessibility @smoke', async ({ app, page }) => {
  await app.todo.open();
  const issues = await runAccessibilitySmoke(page);
  expect(issues.filter(issue => issue.severity === 'error')).toEqual([]);
});
