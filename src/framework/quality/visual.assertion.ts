import { expect, type Page, type PageScreenshotOptions } from '@playwright/test';

export interface VisualAssertionOptions extends Omit<PageScreenshotOptions, 'path'> {
  maxDiffPixelRatio?: number;
  threshold?: number;
}

/**
 * Reusable visual-regression boundary built on Playwright snapshots.
 * Teams can later replace/augment this with Applitools, Percy, TestMu SmartUI or another provider without changing business tests.
 */
export async function expectVisualSnapshot(page: Page, name: string, options: VisualAssertionOptions = {}): Promise<void> {
  await expect(page).toHaveScreenshot(name, options);
}
