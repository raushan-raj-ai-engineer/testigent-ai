import { expect } from '@playwright/test';
import type { TodoPage } from '../pages/todo.page';

/**
 * Author: Raushan Raj
 * Business Use: Reusable business journey for creating and validating work items.
 * How to use: Tests call open(), addTodo() and verifyTodoVisible() inside business `test.step()` blocks.
 * Benefit: Reports/tests read in business language and workflows can be reused across suites.
 */
export class TodoWorkflow {
  constructor(private readonly todoPage: TodoPage) {}
  async open(): Promise<void> { await this.todoPage.open(); }
  async addTodo(text: string): Promise<void> { await this.todoPage.addTodo(text); }
  async verifyTodoVisible(text: string): Promise<void> { await expect(this.todoPage.todoItem(text)).toBeVisible(); }
  async addTodoAndVerify(text: string): Promise<void> { await this.addTodo(text); await this.verifyTodoVisible(text); }
}
