import { test, expect } from '../../fixtures/test.fixture';
import { runAccessibilitySmoke } from '../../../../src/framework/quality/accessibility.smoke';

test('TodoMVC accessibility smoke @accessibility @lane:accessibility @smoke', async ({ page }) => {
  await page.goto('/');
  const issues = await runAccessibilitySmoke(page);
  expect(issues.filter(issue => issue.severity === 'error')).toEqual([]);
});
