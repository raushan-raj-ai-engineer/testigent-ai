import type { Page } from '@playwright/test';
import { BasePage } from '../../../../src/framework/core/ui/base.page';
import type { HealingOrchestrator } from '../../../../src/framework/healing/healing.orchestrator';
import type { LocatorPlan } from '../../../../src/framework/healing/healing.types';

const newTodo: LocatorPlan = {
  id: 'demo.todo.new',
  businessName: 'New todo input',
  primary: { type: 'placeholder', value: 'What needs to be done?' },
  fallbacks: [
    { type: 'role', role: 'textbox', name: 'What needs to be done?' },
    { type: 'css', value: 'input.new-todo' }
  ]
};

/**
 * Author: Raushan Raj
 * Business Use: Demo Page Object showing semantic locators + guarded healing.
 * How to use: Prefer workflows in tests; page methods should represent page-level operations.
 * Benefit: UI technical changes stay in page classes instead of leaking into business tests.
 */
export class TodoPage extends BasePage {
  constructor(page: Page, healer: HealingOrchestrator) { super(page, healer); }

  async open(): Promise<void> {
    await this.navigate('/todomvc/');
  }

  async addTodo(text: string): Promise<void> {
    await this.healer.fillAndPress(newTodo, text, 'Enter');
  }

  todoItem(text: string) {
    return this.page.getByText(text, { exact: true });
  }
}
