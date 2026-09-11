import type { Page } from '@playwright/test';

export type AccessibilitySeverity = 'error' | 'warning';

export interface AccessibilitySmokeIssue {
  rule: string;
  severity: AccessibilitySeverity;
  message: string;
  selector?: string;
}

/**
 * Author: Raushan Raj
 * Business Use: Fast dependency-free accessibility smoke gate for every PR.
 * Important: This intentionally covers high-signal DOM basics only; it does not claim WCAG conformance.
 * Enterprise extension: plug a full axe/BrowserStack/other accessibility engine into a dedicated lane for deeper audits.
 */
export async function runAccessibilitySmoke(page: Page): Promise<AccessibilitySmokeIssue[]> {
  return page.evaluate(() => {
    const issues: AccessibilitySmokeIssue[] = [];
    const html = document.documentElement;
    if (!html.getAttribute('lang')?.trim()) issues.push({ rule: 'html-lang', severity: 'warning', message: '<html> should declare a language.' });

    for (const image of Array.from(document.querySelectorAll('img'))) {
      if (!image.hasAttribute('alt')) issues.push({ rule: 'image-alt', severity: 'error', message: 'Image is missing an alt attribute.', selector: selectorFor(image) });
    }

    for (const control of Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea'))) {
      const element = control as HTMLInputElement;
      const id = element.id;
      const hasLabel = Boolean(id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
      const wrapped = Boolean(element.closest('label'));
      const aria = Boolean(element.getAttribute('aria-label')?.trim() || element.getAttribute('aria-labelledby')?.trim());
      if (!hasLabel && !wrapped && !aria) issues.push({ rule: 'form-label', severity: 'error', message: 'Form control has no programmatic label.', selector: selectorFor(element) });
    }

    for (const button of Array.from(document.querySelectorAll('button, [role="button"]'))) {
      const text = button.textContent?.trim();
      const aria = button.getAttribute('aria-label')?.trim() || button.getAttribute('aria-labelledby')?.trim();
      if (!text && !aria) issues.push({ rule: 'button-name', severity: 'error', message: 'Button has no accessible name.', selector: selectorFor(button) });
    }

    const ids = new Map<string, number>();
    for (const element of Array.from(document.querySelectorAll('[id]'))) {
      const id = element.id;
      ids.set(id, (ids.get(id) ?? 0) + 1);
    }
    for (const [id, count] of ids) if (count > 1) issues.push({ rule: 'duplicate-id', severity: 'error', message: `ID '${id}' is duplicated ${count} times.`, selector: `#${id}` });

    return issues;

    function selectorFor(element: Element): string {
      if (element.id) return `#${element.id}`;
      const testId = element.getAttribute('data-testid');
      if (testId) return `[data-testid="${testId}"]`;
      return element.tagName.toLowerCase();
    }
  });
}

/** Throws only for accessibility smoke errors, leaving warnings available for reporting. */
export function assertAccessibilitySmoke(issues: AccessibilitySmokeIssue[]): void {
  const errors = issues.filter(issue => issue.severity === 'error');
  if (errors.length) throw new Error(`Accessibility smoke failed:\n${errors.map(issue => `- ${issue.rule}: ${issue.message}${issue.selector ? ` (${issue.selector})` : ''}`).join('\n')}`);
}
