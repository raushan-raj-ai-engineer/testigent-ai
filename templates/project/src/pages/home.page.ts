import { expect, type Page } from '@playwright/test';
import { BasePage } from '../../../../src/framework/core/ui/base.page';
import type { HealingOrchestrator } from '../../../../src/framework/healing/healing.orchestrator';

/** Project landing page. Keep selectors/UI mechanics here; business tests use workflows through AppFacade. */
export class HomePage extends BasePage {
  constructor(page: Page, healer: HealingOrchestrator) { super(page, healer); }

  async open(): Promise<void> { await this.navigate('/'); }
  async verifyReady(): Promise<void> { await expect(this.page.locator('body')).toBeVisible(); }
}
