import type { Page } from '@playwright/test';
import type { HealingOrchestrator } from '../../../src/framework/healing/healing.orchestrator';
import { UserManagementPage } from './pages/user-management.page';
import { UserManagementWorkflow } from './workflows/user-management.workflow';

export class SdetPracticeAppFacade {
  readonly userManagement: UserManagementWorkflow;
  constructor(page: Page, healer: HealingOrchestrator) {
    this.userManagement = new UserManagementWorkflow(new UserManagementPage(page, healer));
  }
}
