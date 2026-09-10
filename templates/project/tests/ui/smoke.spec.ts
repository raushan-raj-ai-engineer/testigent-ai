import { test, expect } from '../../fixtures/test.fixture';

test('__PROJECT__ smoke @smoke @ui', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/.+/);
});
