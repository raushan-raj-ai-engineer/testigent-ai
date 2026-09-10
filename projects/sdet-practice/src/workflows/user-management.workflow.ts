/**
 * GENERATED PROPOSAL - REVIEW_REQUIRED
 * Requirement: sdet-user-crud
 * Do not merge before human review.
 * Author: Raushan Raj
 */

import {
  type CreateUserData,
  type UpdateUserData,
  UserManagementPage,
} from '../pages/user-management.page.js';

export class UserManagementWorkflow {

  constructor(
    private readonly userManagementPage: UserManagementPage,
  ) { }

  async createUser(
    user: CreateUserData,
  ): Promise<void> {

    await this.userManagementPage.createUser(user);

    await this.userManagementPage
      .verifyUserVisible(user.email);
  }

  async updateUser(
    existingEmail: string,
    updatedUser: UpdateUserData,
  ): Promise<void> {

    await this.userManagementPage
      .openUserForEdit(existingEmail);

    await this.userManagementPage
      .updateUser(updatedUser);

    const expectedEmail =
      updatedUser.email ?? existingEmail;

    if (updatedUser.name) {
      await this.userManagementPage
        .verifyUpdatedUser(
          expectedEmail,
          updatedUser.name,
        );
    } else {
      await this.userManagementPage
        .verifyUserVisible(expectedEmail);
    }
  }

  async deleteUser(
    email: string,
  ): Promise<void> {

    await this.userManagementPage
      .deleteUser(email);

    await this.userManagementPage
      .verifyUserNotVisible(email);
  }
}