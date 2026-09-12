import type { Page } from '@playwright/test';
import type { HealingOrchestrator } from '../../healing/healing.orchestrator.js';
import type { HealingActionOptions, LocatorPlan } from '../../healing/healing.types.js';
import { RuntimeConfig } from '../config/runtime.config.js';
import { assertAuthenticatedPage } from '../auth.verifier.js';

/**
 * Author: Raushan Raj
 * Business Use: Minimal common base for application pages with guarded healing-aware UI actions.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page, protected readonly healer: HealingOrchestrator) {}

  async navigate(url: string, options: { verifyAuth?: boolean } = {}): Promise<void> {
    await this.page.goto(url);
    if (options.verifyAuth === false) return;
    const runtime = RuntimeConfig.resolve();
    if (runtime.auth.strategy === 'storageState' && runtime.auth.required !== false) {
      await assertAuthenticatedPage(this.page, runtime.auth.verification);
    }
  }

  protected async healingClick(plan: LocatorPlan, options: HealingActionOptions = {}): Promise<void> {
    await this.healer.click(plan, options);
  }

  protected async healingFill(plan: LocatorPlan, value: string, options: HealingActionOptions = {}): Promise<void> {
    await this.healer.fill(plan, value, options);
  }

  protected async healingFillAndPress(plan: LocatorPlan, value: string, key: string, options: HealingActionOptions = {}): Promise<void> {
    await this.healer.fillAndPress(plan, value, key, options);
  }
}
