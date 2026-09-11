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

  private readonly userModalScope = {
    id: 'sdet.user.modal',
    businessName: 'User management modal',
    primary: { type: 'css', value: '#user-modal' } as const
  };

  // Prefer semantic accessible-name patterns so benign copy changes such as "Create User",
  // "+ Create User", "Add User" or "New User" do not force selector maintenance. Structural
  // modal relationships are deterministic fallbacks and are still protected by the modal-visible
  // post-condition before any recovery is accepted or reported as successful.
  private readonly openCreatePlan: LocatorPlan = {
    id: 'sdet.user.create.open',
    businessName: 'Open Create User',
    primary: {
      type: 'role',
      role: 'button',
      namePattern: '(?:\\b(?:create|add|new)\\b.*\\buser\\b|\\buser\\b.*\\b(?:create|add|new)\\b)',
      namePatternFlags: 'i',
      match: 'firstVisible'
    },
    fallbacks: [
      {
        type: 'role', role: 'link',
        namePattern: '(?:\\b(?:create|add|new)\\b.*\\buser\\b|\\buser\\b.*\\b(?:create|add|new)\\b)',
        namePatternFlags: 'i', match: 'firstVisible'
      },
      { type: 'css', value: '[aria-controls="user-modal"]', match: 'firstVisible' },
      { type: 'css', value: '[data-bs-target="#user-modal"]', match: 'firstVisible' },
      { type: 'css', value: '[data-target="#user-modal"]', match: 'firstVisible' },
      { type: 'css', value: 'a[href="#user-modal"]', match: 'firstVisible' },
      { type: 'css', value: 'button[onclick*="user-modal" i], a[onclick*="user-modal" i]', match: 'firstVisible' },
      { type: 'css', value: 'button[id*="user" i][id*="create" i], button[id*="user" i][id*="add" i], button[id*="user" i][id*="new" i]', match: 'firstVisible' },
      { type: 'css', value: '[data-testid*="user" i][data-testid*="create" i], [data-testid*="user" i][data-testid*="add" i], [data-testid*="user" i][data-testid*="new" i]', match: 'firstVisible' }
    ]
  };

  private readonly userManagementNavigationPlan: LocatorPlan = {
    id: 'sdet.user.navigation',
    businessName: 'Open User Management area',
    primary: {
      type: 'role', role: 'link',
      namePattern: '(?:user\\s*management|manage\\s*users?|^users?$)',
      namePatternFlags: 'i', match: 'firstVisible'
    },
    fallbacks: [
      { type: 'role', role: 'button', namePattern: '(?:user\\s*management|manage\\s*users?|^users?$)', namePatternFlags: 'i', match: 'firstVisible' },
      { type: 'role', role: 'menuitem', namePattern: '(?:user\\s*management|manage\\s*users?|^users?$)', namePatternFlags: 'i', match: 'firstVisible' },
      { type: 'role', role: 'tab', namePattern: '(?:user\\s*management|manage\\s*users?|^users?$)', namePatternFlags: 'i', match: 'firstVisible' },
      // Some layouts reveal the Users entry only after opening an Administration menu. This
      // is safe to retry because success is defined only by the user-management entry appearing.
      { type: 'role', role: 'button', namePattern: '^(?:admin|administration)$', namePatternFlags: 'i', match: 'firstVisible' },
      { type: 'role', role: 'link', namePattern: '^(?:admin|administration)$', namePatternFlags: 'i', match: 'firstVisible' },
      { type: 'role', role: 'menuitem', namePattern: '^(?:admin|administration)$', namePatternFlags: 'i', match: 'firstVisible' }
    ]
  };

  private readonly namePlan: LocatorPlan = {
    id: 'sdet.user.form.name',
    businessName: 'User name',
    scope: this.userModalScope,
    primary: { type: 'label', value: 'Name', exact: true },
    fallbacks: [{ type: 'css', value: 'input[name="name"]' }]
  };
  private readonly emailPlan: LocatorPlan = {
    id: 'sdet.user.form.email',
    businessName: 'User email',
    scope: this.userModalScope,
    primary: { type: 'label', value: 'Email', exact: true },
    fallbacks: [{ type: 'css', value: 'input[name="email"]' }]
  };
  private readonly passwordPlan: LocatorPlan = {
    id: 'sdet.user.form.password',
    businessName: 'User password',
    scope: this.userModalScope,
    primary: { type: 'label', value: 'Password', exact: true },
    fallbacks: [{ type: 'css', value: 'input[name="password"]' }]
  };
  private readonly confirmPasswordPlan: LocatorPlan = {
    id: 'sdet.user.form.confirm-password',
    businessName: 'Confirm password',
    scope: this.userModalScope,
    primary: { type: 'label', value: 'Confirm Password', exact: true },
    fallbacks: [{ type: 'css', value: 'input[name="confirm-password"]' }]
  };
  private readonly createSubmitPlan: LocatorPlan = {
    id: 'sdet.user.create.submit',
    businessName: 'Submit Create User modal',
    scope: this.userModalScope,
    primary: { type: 'role', role: 'button', name: 'Save User', exact: true },
    fallbacks: [
      { type: 'css', value: 'button[type="submit"]' },
      { type: 'role', role: 'button', name: 'Create', exact: true },
      { type: 'role', role: 'button', name: 'Save', exact: true }
    ]
  };
  private readonly updateSubmitPlan: LocatorPlan = {
    id: 'sdet.user.update.submit',
    businessName: 'Submit Update User modal',
    scope: this.userModalScope,
    primary: { type: 'css', value: 'button[type="submit"]' },
    fallbacks: [
      { type: 'role', role: 'button', name: 'Save User', exact: true },
      { type: 'role', role: 'button', name: 'Update', exact: true },
      { type: 'role', role: 'button', name: 'Save', exact: true }
    ]
  };
  private readonly editPlan: LocatorPlan = {
    id: 'sdet.user.row.edit',
    businessName: 'Edit user row',
    primary: { type: 'role', role: 'button', name: 'Edit', exact: true }
  };
  private readonly deletePlan: LocatorPlan = {
    id: 'sdet.user.row.delete',
    businessName: 'Delete user row',
    primary: { type: 'role', role: 'button', name: 'Delete', exact: true }
  };

  private async createEntryPointIsVisible(): Promise<boolean> {
    const semanticPattern = /(?:\b(?:create|add|new)\b.*\buser\b|\buser\b.*\b(?:create|add|new)\b)/i;
    const candidates = [
      this.page.getByRole('button', { name: semanticPattern }).visible(),
      this.page.getByRole('link', { name: semanticPattern }).visible(),
      this.page.locator('[aria-controls="user-modal"], [data-bs-target="#user-modal"], [data-target="#user-modal"], a[href="#user-modal"]').visible(),
      this.page.locator('button[onclick*="user-modal" i], a[onclick*="user-modal" i]').visible(),
      this.page.locator('button[id*="user" i][id*="create" i], button[id*="user" i][id*="add" i], button[id*="user" i][id*="new" i]').visible(),
      this.page.locator('[data-testid*="user" i][data-testid*="create" i], [data-testid*="user" i][data-testid*="add" i], [data-testid*="user" i][data-testid*="new" i]').visible()
    ];
    for (const candidate of candidates) {
      if (await candidate.count().catch(() => 0)) return true;
    }
    return false;
  }

  private userModal(): Locator { return this.page.locator('#user-modal'); }
  private userRow(email: string): Locator { return this.page.getByRole('row').filter({ hasText: email }); }

  async open(): Promise<void> {
    await this.navigate('/');
    if (await this.createEntryPointIsVisible()) return;

    await this.healingClick(this.userManagementNavigationPlan, {
      retryOnPostConditionFailure: true,
      postCondition: {
        description: 'User Management area exposes a Create/Add/New User entry point',
        timeoutMs: 1_500,
        intervalMs: 100,
        verify: () => this.createEntryPointIsVisible()
      }
    });
  }

  async openCreateUserForm(): Promise<void> {
    await this.healingClick(this.openCreatePlan, {
      retryOnPostConditionFailure: true,
      postCondition: {
        description: 'Create User modal becomes visible',
        verify: () => this.userModal().isVisible()
      }
    });
    await expect(this.userModal()).toBeVisible();
  }

  async fillCreateUserForm(user: CreateUserData): Promise<void> {
    await this.healingFill(this.namePlan, user.name);
    await this.healingFill(this.emailPlan, user.email);
    await this.healingFill(this.passwordPlan, user.password);
    const confirm = await this.healer.resolve(this.confirmPasswordPlan).catch(() => undefined);
    if (confirm && await confirm.isVisible().catch(() => false)) await this.healingFill(this.confirmPasswordPlan, user.password);
  }

  async submitCreateUser(): Promise<void> {
    await this.healingClick(this.createSubmitPlan, {
      postCondition: {
        description: 'Create User modal closes after saving',
        verify: async () => !(await this.userModal().isVisible())
      }
    });
    await expect(this.userModal()).toBeHidden();
  }

  async createUser(user: CreateUserData): Promise<void> {
    await this.openCreateUserForm();
    await this.fillCreateUserForm(user);
    await this.submitCreateUser();
  }

  async openUserForEdit(email: string): Promise<void> {
    const row = this.userRow(email);
    await expect(row).toBeVisible();
    await this.healer.clickWithin(row, this.editPlan, {
      retryOnPostConditionFailure: true,
      postCondition: {
        description: 'User management modal becomes visible for editing',
        verify: () => this.userModal().isVisible()
      }
    });
    await expect(this.userModal()).toBeVisible();
  }

  async updateUser(data: UpdateUserData): Promise<void> {
    if (data.name !== undefined) await this.healingFill(this.namePlan, data.name);
    if (data.email !== undefined) await this.healingFill(this.emailPlan, data.email);
    await this.healingClick(this.updateSubmitPlan, {
      postCondition: {
        description: 'User management modal closes after updating',
        verify: async () => !(await this.userModal().isVisible())
      }
    });
    await expect(this.userModal()).toBeHidden();
  }

  async deleteUser(email: string): Promise<void> {
    const row = this.userRow(email);
    await expect(row).toBeVisible();
    await this.healer.clickWithin(row, this.deletePlan);
  }

  async verifyUserVisible(email: string): Promise<void> { await expect(this.userRow(email)).toBeVisible(); }
  async verifyUserNotVisible(email: string): Promise<void> { await expect(this.userRow(email)).toHaveCount(0); }
  async verifyUpdatedUser(email: string, expectedName: string): Promise<void> {
    const row = this.userRow(email);
    await expect(row).toBeVisible();
    await expect(row).toContainText(expectedName);
  }
}
