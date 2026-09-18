import type { BrowserContext, Page } from '@playwright/test';
import type { HealingOrchestrator } from '../../healing/healing.orchestrator.js';
import type { HealingActionOptions, LocatorPlan } from '../../healing/healing.types.js';
import { RuntimeConfig } from '../config/runtime.config.js';
import { AuthManager } from '../auth.manager.js';

const authManagersByContext = new WeakMap<BrowserContext, AuthManager>();
const authDisabledContexts = new WeakSet<BrowserContext>();

function authManagerFor(page: Page): AuthManager | undefined {
  const context = page.context();
  const existing = authManagersByContext.get(context);
  if (existing) return existing;
  if (authDisabledContexts.has(context)) return undefined;
  const runtime = RuntimeConfig.resolve();
  if (runtime.auth.strategy !== 'storageState' || runtime.auth.required === false) {
    authDisabledContexts.add(context);
    return undefined;
  }
  const manager = new AuthManager(runtime);
  authManagersByContext.set(context, manager);
  return manager;
}

/**
 * Author: Raushan Raj
 * Business Use: Minimal common base for application pages with guarded healing-aware UI actions.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page, protected readonly healer: HealingOrchestrator) {}

  async navigate(url: string, options: { verifyAuth?: boolean } = {}): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    if (options.verifyAuth === false) return;
    await authManagerFor(this.page)?.ensureAuthenticatedNavigation(this.page, url);
  }

  protected async healingClick(plan: LocatorPlan, options: HealingActionOptions = {}): Promise<void> {
    await authManagerFor(this.page)?.ensureFreshBeforeAction(this.page);
    await this.healer.click(plan, options);
  }

  protected async healingFill(plan: LocatorPlan, value: string, options: HealingActionOptions = {}): Promise<void> {
    await authManagerFor(this.page)?.ensureFreshBeforeAction(this.page);
    await this.healer.fill(plan, value, options);
  }

  protected async healingFillAndPress(plan: LocatorPlan, value: string, key: string, options: HealingActionOptions = {}): Promise<void> {
    await authManagerFor(this.page)?.ensureFreshBeforeAction(this.page);
    await this.healer.fillAndPress(plan, value, key, options);
  }
}
