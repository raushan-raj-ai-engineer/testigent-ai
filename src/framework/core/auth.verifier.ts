import type { Page } from '@playwright/test';
import type { ProjectAuthVerificationConfig } from './config/config.types';

export interface AuthVerificationResult {
  ok: boolean;
  reason?: string;
}

/**
 * Verifies that the current page satisfies the configured project
 * authentication contract.
 *
 * Verification happens before locator healing so an expired or invalid
 * session cannot be misclassified as a selector failure.
 */
export async function verifyAuthenticatedPage(
  page: Page,
  verification: ProjectAuthVerificationConfig | undefined,
): Promise<AuthVerificationResult> {
  if (!verification) return { ok: true };
  const timeout = verification.timeoutMs ?? 3_000;
  const settleMs = verification.settleMs ?? 250;
  if (settleMs > 0) await page.waitForTimeout(settleMs);

  if (verification.unauthenticatedUrlPattern) {
    const rx = compilePattern(verification.unauthenticatedUrlPattern, verification.urlPatternFlags);
    if (rx.test(page.url())) return { ok: false, reason: `URL '${page.url()}' matches unauthenticatedUrlPattern.` };
  }
  if (verification.authenticatedUrlPattern) {
    const rx = compilePattern(verification.authenticatedUrlPattern, verification.urlPatternFlags);
    if (!rx.test(page.url())) return { ok: false, reason: `URL '${page.url()}' does not match authenticatedUrlPattern.` };
  }

  if (verification.stateKey) {
    const { name, storage = 'either' } = verification.stateKey;
    const found = await page.evaluate(({ key, mode }) => {
      const localValue = mode === 'session' ? null : localStorage.getItem(key);
      const sessionValue = mode === 'local' ? null : sessionStorage.getItem(key);
      return Boolean(localValue || sessionValue);
    }, { key: name, mode: storage });
    if (!found) return { ok: false, reason: `Required auth state key '${name}' is missing from ${storage} storage.` };
  }

  if (verification.unauthenticatedControl) {
    const control = verification.unauthenticatedControl;
    const locator = controlLocator(page, control).first();
    if (await locator.isVisible().catch(() => false)) {
      return { ok: false, reason: `Unauthenticated control '${control.namePattern ?? control.name ?? control.role}' is visible.` };
    }
  }

  if (verification.authenticatedControl) {
    const control = verification.authenticatedControl;
    const locator = controlLocator(page, control).first();
    try {
      await locator.waitFor({ state: 'visible', timeout });
    } catch {
      return { ok: false, reason: `Authenticated control '${control.namePattern ?? control.name ?? control.role}' is not visible.` };
    }
  }

  return { ok: true };
}

/**
 * Enforces the configured authentication contract and fails fast when the
 * restored browser session is not authenticated.
 *
 * Authentication failures are surfaced as authentication errors instead of
 * being forwarded to the self-healing locator pipeline.
 */
export async function assertAuthenticatedPage(
  page: Page,
  verification: ProjectAuthVerificationConfig | undefined,
): Promise<void> {
  const result = await verifyAuthenticatedPage(page, verification);
  if (!result.ok) {
    throw new Error(
      `AUTH_SESSION_INVALID: ${result.reason ?? 'Authentication verification failed.'} ` +
      `Refresh the configured auth state with 'npm run qa:auth' before UI execution.`,
    );
  }
}

function controlLocator(page: Page, control: NonNullable<ProjectAuthVerificationConfig['unauthenticatedControl']>) {
  return page.getByRole(control.role, {
    name: control.namePattern
      ? compilePattern(control.namePattern, control.namePatternFlags)
      : control.name,
    exact: control.namePattern ? undefined : control.exact,
  }).visible();
}

function compilePattern(source: string, flags = 'i'): RegExp {
  try { return new RegExp(source, flags); }
  catch (error) { throw new Error(`Invalid auth verification pattern '${source}': ${error instanceof Error ? error.message : String(error)}`); }
}
