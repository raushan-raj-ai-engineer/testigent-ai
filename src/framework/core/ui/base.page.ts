import type { Page } from '@playwright/test';
import type { HealingOrchestrator } from '../../healing/healing.orchestrator.js';
import type { LocatorPlan } from '../../healing/healing.types.js';

/**
 * Author: Raushan Raj
 * Business Use: Minimal common base for application pages with guarded healing-aware UI actions.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page, protected readonly healer: HealingOrchestrator) {}

  async navigate(url: string): Promise<void> {
    await this.page.goto(url);
  }

  protected async healingClick(plan: LocatorPlan): Promise<void> {
    await this.healer.click(plan);
  }

  protected async healingFill(plan: LocatorPlan, value: string): Promise<void> {
    await this.healer.fill(plan, value);
  }

  protected async healingFillAndPress(plan: LocatorPlan, value: string, key: string): Promise<void> {
    await this.healer.fillAndPress(plan, value, key);
  }
}
