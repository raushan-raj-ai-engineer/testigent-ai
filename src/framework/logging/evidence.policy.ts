import type { Page } from '@playwright/test';

export type VisualEvidencePolicy = 'masked' | 'off' | 'standard';

const DEFAULT_MASK_SELECTORS = [
  'input[type="password"]',
  '[data-sensitive="true"]',
  '[data-private="true"]',
  '[data-testid*="secret" i]',
  '[data-testid*="token" i]',
];

/**
 * Visual evidence is secure-by-default. `masked` disables Playwright's automatic trace/video/screenshot
 * capture (which cannot apply project masks consistently) and permits only framework-managed masked screenshots.
 * `standard` must be explicitly opted into for synthetic/non-sensitive environments.
 */
export function resolveVisualEvidencePolicy(env: NodeJS.ProcessEnv = process.env): VisualEvidencePolicy {
  const value = (env.EVIDENCE_VISUAL_POLICY ?? 'masked').trim().toLowerCase();
  if (!['masked', 'off', 'standard'].includes(value)) {
    throw new Error(`EVIDENCE_VISUAL_POLICY must be masked, off or standard; received '${value}'.`);
  }
  if (value === 'standard' && env.EVIDENCE_ALLOW_UNMASKED_VISUALS !== 'true') {
    throw new Error('EVIDENCE_VISUAL_POLICY=standard requires EVIDENCE_ALLOW_UNMASKED_VISUALS=true.');
  }
  return value as VisualEvidencePolicy;
}

/** Builds Playwright mask locators from the secure default and project-supplied sensitive selectors. */
export function visualEvidenceMaskLocators(page: Page, env: NodeJS.ProcessEnv = process.env) {
  return resolveMaskSelectors(env).map(selector => page.locator(selector));
}

/** Resolves and validates the CSS selectors that must be masked in framework-managed screenshots. */
export function resolveMaskSelectors(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.EVIDENCE_MASK_SELECTORS?.trim();
  if (!raw) return [...DEFAULT_MASK_SELECTORS];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string' || !item.trim())) {
      throw new Error('not a string array');
    }
    return [...new Set([...DEFAULT_MASK_SELECTORS, ...parsed.map(item => String(item).trim())])];
  } catch {
    throw new Error('EVIDENCE_MASK_SELECTORS must be a JSON string array of CSS selectors.');
  }
}
