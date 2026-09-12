import type { Page } from '@playwright/test';
import type { HealingOrchestrator } from '../../../src/framework/healing/healing.orchestrator';
import { HomePage } from './pages/home.page';
import { HomeWorkflow } from './workflows/home.workflow';

/** Single UI entrypoint exposed to tests. Add domain workflows here, not framework services. */
export class ProjectAppFacade {
  readonly home: HomeWorkflow;
  constructor(page: Page, healer: HealingOrchestrator) {
    this.home = new HomeWorkflow(new HomePage(page, healer));
  }
}
