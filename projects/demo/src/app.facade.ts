import type { Page } from '@playwright/test';
import type { HealingOrchestrator } from '../../../src/framework/healing/healing.orchestrator';
import { TodoPage } from './pages/todo.page';
import { TodoWorkflow } from './workflows/todo.workflow';

export class DemoAppFacade {
  readonly todo: TodoWorkflow;
  constructor(page: Page, healer: HealingOrchestrator) {
    this.todo = new TodoWorkflow(new TodoPage(page, healer));
  }
}
