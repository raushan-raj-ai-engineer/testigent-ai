import type { Locator, Page } from '@playwright/test';
import type { LocatorDescriptor } from './healing.types.js';

export type LocatorRoot = Page | Locator;

/**
 * Author: Raushan Raj
 * Business Use: Converts semantic locator metadata into Playwright locators from a page or scoped container.
 */
export function resolveLocator(root: LocatorRoot, descriptor: LocatorDescriptor): Locator {
  switch (descriptor.type) {
    case 'role': return root.getByRole(descriptor.role, descriptor.name ? { name: descriptor.name, exact: descriptor.exact } : undefined);
    case 'label': return root.getByLabel(descriptor.value, { exact: descriptor.exact });
    case 'testId': return root.getByTestId(descriptor.value);
    case 'placeholder': return root.getByPlaceholder(descriptor.value, { exact: descriptor.exact });
    case 'text': return root.getByText(descriptor.value, { exact: descriptor.exact ?? true });
    case 'css': return root.locator(descriptor.value);
  }
}
