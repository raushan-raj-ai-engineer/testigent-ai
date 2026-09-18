import { test, expect } from '../../fixtures/test.fixture';
import { runAccessibilitySmoke } from '../../../../src/framework/quality/accessibility.smoke';

test.skip(
  process.env.RUN_EXTERNAL_TESTS !== 'true',
  'External public demo dependency; run with npm run test:external.',
);

test('TodoMVC accessibility smoke @accessibility @lane:accessibility @smoke @external', async ({ app, page }) => {
  await app.todo.open();
  const issues = await runAccessibilitySmoke(page);
  expect(issues.filter(issue => issue.severity === 'error')).toEqual([]);
});
