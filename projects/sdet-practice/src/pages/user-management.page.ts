/**
 * GENERATED PROPOSAL - REVIEW_REQUIRED
 * Requirement: sdet-user-crud
 * Do not merge before human review.
 * Author: Raushan Raj
 */
import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '../../../../src/framework/core/ui/base.page.js';
import type { HealingOrchestrator } from '../../../../src/framework/healing/healing.orchestrator.js';
import type { LocatorPlan } from '../../../../src/framework/healing/healing.types.js';

export interface CreateUserData { name: string; email: string; password: string; }
export interface UpdateUserData { name?: string; email?: string; }

export class UserManagementPage extends BasePage {
  constructor(page: Page, healer: HealingOrchestrator) { super(page, healer); }

  private readonly userModalScope = { id: 'sdet.user.modal', businessName: 'User management modal', primary: { type: 'css', value: '#user-modal' } as const };
  private readonly openCreatePlan: LocatorPlan = { id: 'sdet.user.create.open', businessName: 'Open Create User', primary: { type: 'css', value: '#create-user-btn' }, fallbacks: [{ type: 'role', role: 'button', name: '+ Create User', exact: true }] };
  private readonly namePlan: LocatorPlan = { id: 'sdet.user.form.name', businessName: 'User name', scope: this.userModalScope, primary: { type: 'css', value: 'input[name="name"]' } };
  private readonly emailPlan: LocatorPlan = { id: 'sdet.user.form.email', businessName: 'User email', scope: this.userModalScope, primary: { type: 'css', value: 'input[name="email"]' } };
  private readonly passwordPlan: LocatorPlan = { id: 'sdet.user.form.password', businessName: 'User password', scope: this.userModalScope, primary: { type: 'css', value: 'input[name="password"]' } };
  private readonly confirmPasswordPlan: LocatorPlan = { id: 'sdet.user.form.confirm-password', businessName: 'Confirm password', scope: this.userModalScope, primary: { type: 'css', value: 'input[name="confirm-password"]' } };
  private readonly createSubmitPlan: LocatorPlan = { id: 'sdet.user.create.submit', businessName: 'Submit Create User modal', scope: this.userModalScope, primary: { type: 'css', value: 'button[type="submit"]' }, fallbacks: [{ type: 'role', role: 'button', name: 'Create', exact: true }, { type: 'role', role: 'button', name: 'Save', exact: true }] };
  private readonly updateSubmitPlan: LocatorPlan = { id: 'sdet.user.update.submit', businessName: 'Submit Update User modal', scope: this.userModalScope, primary: { type: 'css', value: 'button[type="submit"]' }, fallbacks: [{ type: 'role', role: 'button', name: 'Update', exact: true }, { type: 'role', role: 'button', name: 'Save', exact: true }] };
  private readonly editPlan: LocatorPlan = { id: 'sdet.user.row.edit', businessName: 'Edit user row', primary: { type: 'role', role: 'button', name: 'Edit', exact: true } };
  private readonly deletePlan: LocatorPlan = { id: 'sdet.user.row.delete', businessName: 'Delete user row', primary: { type: 'role', role: 'button', name: 'Delete', exact: true } };

  private userRow(email: string): Locator { return this.page.getByRole('row').filter({ hasText: email }); }

  async openCreateUserForm(): Promise<void> { await this.healingClick(this.openCreatePlan); await expect(this.page.locator('#user-modal')).toBeVisible(); }
  async fillCreateUserForm(user: CreateUserData): Promise<void> {
    await this.healingFill(this.namePlan, user.name);
    await this.healingFill(this.emailPlan, user.email);
    await this.healingFill(this.passwordPlan, user.password);
    const confirm = await this.healer.resolve(this.confirmPasswordPlan).catch(() => undefined);
    if (confirm && await confirm.isVisible().catch(() => false)) await this.healingFill(this.confirmPasswordPlan, user.password);
  }
  async submitCreateUser(): Promise<void> { await this.healingClick(this.createSubmitPlan); await expect(this.page.locator('#user-modal')).toBeHidden(); }
  async createUser(user: CreateUserData): Promise<void> { await this.openCreateUserForm(); await this.fillCreateUserForm(user); await this.submitCreateUser(); }

  async openUserForEdit(email: string): Promise<void> { const row = this.userRow(email); await expect(row).toBeVisible(); await this.healer.clickWithin(row, this.editPlan); await expect(this.page.locator('#user-modal')).toBeVisible(); }
  async updateUser(data: UpdateUserData): Promise<void> { if (data.name !== undefined) await this.healingFill(this.namePlan, data.name); if (data.email !== undefined) await this.healingFill(this.emailPlan, data.email); await this.healingClick(this.updateSubmitPlan); await expect(this.page.locator('#user-modal')).toBeHidden(); }
  async deleteUser(email: string): Promise<void> { const row = this.userRow(email); await expect(row).toBeVisible(); await this.healer.clickWithin(row, this.deletePlan); }
  async verifyUserVisible(email: string): Promise<void> { await expect(this.userRow(email)).toBeVisible(); }
  async verifyUserNotVisible(email: string): Promise<void> { await expect(this.userRow(email)).toHaveCount(0); }
  async verifyUpdatedUser(email: string, expectedName: string): Promise<void> { const row = this.userRow(email); await expect(row).toBeVisible(); await expect(row).toContainText(expectedName); }
}
