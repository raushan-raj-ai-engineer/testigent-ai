import { expect, test as playwrightTest, type Locator, type Page } from '@playwright/test';
import { ApplicationRegistry } from '../core/config/application.registry';
import type { DeclarativeLocator, DeclarativeScenario, DeclarativeStep } from './scenario.schema';
import { resolveDeclarativeNavigationUrl } from './scenario.navigation';

export interface DeclarativeRunnerOptions {
  uiBaseUrl?: string;
}

/**
 * Executes the constrained TestigentAI declarative UI DSL using Playwright auto-waiting and semantic locators.
 * Arbitrary JavaScript/shell execution is intentionally excluded so low-code scenarios remain reviewable and governed.
 */
export async function runDeclarativeScenario(
  page: Page,
  scenario: DeclarativeScenario,
  options: DeclarativeRunnerOptions = {},
): Promise<void> {
  const uiBaseUrl = options.uiBaseUrl ?? ApplicationRegistry.current().uiBaseUrl;
  for (const [index, step] of scenario.steps.entries()) {
    await playwrightTest.step(`DSL ${index + 1}/${scenario.steps.length}: ${describeStep(step)}`, async () => {
      await runStep(page, step, uiBaseUrl);
    });
  }
}

async function runStep(page: Page, step: DeclarativeStep, uiBaseUrl: string): Promise<void> {
  if (step.action === 'goto') {
    await page.goto(
      resolveDeclarativeNavigationUrl(uiBaseUrl, step.url),
      { waitUntil: 'domcontentloaded' },
    );
    return;
  }

  const locator = resolveDeclarativeLocator(page, step);
  switch (step.action) {
    case 'click': await locator.click(); return;
    case 'fill': await locator.fill(step.text); return;
    case 'check': await locator.check(); return;
    case 'uncheck': await locator.uncheck(); return;
    case 'select': await locator.selectOption(step.option); return;
    case 'press': await locator.press(step.key); return;
    case 'expectVisible': await expect(locator).toBeVisible(); return;
    case 'expectHidden': await expect(locator).toBeHidden(); return;
    case 'expectText':
      if (step.match === 'exact') await expect(locator).toHaveText(step.text);
      else await expect(locator).toContainText(step.text);
      return;
    case 'expectValue': await expect(locator).toHaveValue(step.expected); return;
  }
}

/** Resolves only allow-listed locator strategies; semantic/user-facing strategies are preferred over CSS. */
export function resolveDeclarativeLocator(page: Page, locator: DeclarativeLocator): Locator {
  switch (locator.by) {
    case 'label': return page.getByLabel(locator.value, { exact: locator.exact });
    case 'text': return page.getByText(locator.value, { exact: locator.exact });
    case 'testId': return page.getByTestId(locator.value);
    case 'placeholder': return page.getByPlaceholder(locator.value, { exact: locator.exact });
    case 'altText': return page.getByAltText(locator.value, { exact: locator.exact });
    case 'title': return page.getByTitle(locator.value, { exact: locator.exact });
    case 'css': return page.locator(locator.value);
    case 'role': return page.getByRole(locator.role, locator.name ? { name: locator.name, exact: locator.exact } : undefined);
  }
}

function describeStep(step: DeclarativeStep): string {
  if (step.action === 'goto') return `goto ${step.url}`;
  const target = step.by === 'role' ? `${step.by}:${step.role}${step.name ? `:${step.name}` : ''}` : `${step.by}:${step.value}`;
  return `${step.action} ${target}`;
}
