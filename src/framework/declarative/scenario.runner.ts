import { expect, type Locator, type Page } from '@playwright/test';
import type { DeclarativeLocator, DeclarativeScenario, DeclarativeStep } from './scenario.types';

/**
 * Executes the constrained TestigentAI declarative scenario DSL using Playwright semantic locators.
 * The DSL intentionally excludes arbitrary code/shell execution so non-code authoring remains governed and reviewable.
 */
export async function runDeclarativeScenario(page: Page, scenario: DeclarativeScenario): Promise<void> {
  for (const step of scenario.steps) await runStep(page, step);
}

async function runStep(page: Page, step: DeclarativeStep): Promise<void> {
  if (step.action === 'goto') { await page.goto(step.url); return; }
  const locator = resolveDeclarativeLocator(page, step);
  switch (step.action) {
    case 'click': await locator.click(); return;
    case 'fill': await locator.fill(step.text); return;
    case 'check': await locator.check(); return;
    case 'select': await locator.selectOption(step.option); return;
    case 'expectVisible': await expect(locator).toBeVisible(); return;
    case 'expectText': await expect(locator).toContainText(step.text); return;
  }
}

/** Resolves only allow-listed semantic locator strategies used by the declarative scenario engine. */
export function resolveDeclarativeLocator(page: Page, locator: DeclarativeLocator): Locator {
  switch (locator.by) {
    case 'label': return page.getByLabel(required(locator.value, 'label value'));
    case 'text': return page.getByText(required(locator.value, 'text value'));
    case 'testId': return page.getByTestId(required(locator.value, 'testId value'));
    case 'placeholder': return page.getByPlaceholder(required(locator.value, 'placeholder value'));
    case 'css': return page.locator(required(locator.value, 'css selector'));
    case 'role': return page.getByRole(required(locator.role, 'role'), locator.name ? { name: locator.name } : undefined);
  }
}

function required<T>(value: T | undefined, label: string): T {
  if (value === undefined || value === '') throw new Error(`Declarative scenario ${label} is required.`);
  return value;
}
