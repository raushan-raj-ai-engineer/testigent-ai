/**
 * HUMAN-APPROVED AUTOMATION
 * Requirement: sdet-user-crud
 * Project: sdet-practice
 * Author: Raushan Raj
 */
import { test } from '../../fixtures/test.fixture.js';
import { KnownDefectRegistry } from '../../../../src/framework/core/known-defects.js';
import type { CreateUserData } from '../../src/pages/user-management.page.js';

const deleteDefect = KnownDefectRegistry.get('sdet-practice', 'SDET-DEL-001');

test(
  'Admin can create, update and delete a user @requirement:sdet-user-crud @app:sdet-practice @critical @user-management @crud @ui',
  async ({ app, data }, testInfo) => {
    const defaults = await data.load<{ namePrefix: string; emailPrefix: string; emailDomain: string; password: string }>(
      'projects/sdet-practice/data/users/create-user.json',
    );
    const uniqueId = `${Date.now()}-${testInfo.workerIndex}-${testInfo.retry}`;
    const originalUser: CreateUserData = {
      name: `${defaults.namePrefix} ${uniqueId}`,
      email: `${defaults.emailPrefix}-${uniqueId}@${defaults.emailDomain}`,
      password: defaults.password,
    };
    const updatedName = `Updated ${defaults.namePrefix} ${uniqueId}`;

    await test.step('Admin opens the user management application', async () => {
      await app.userManagement.open();
    });

    await test.step('Admin creates a new user', async () => {
      await app.userManagement.createUser(originalUser);
    });

    await test.step('Admin updates the created user', async () => {
      await app.userManagement.updateUser(originalUser.email, { name: updatedName });
    });

    if (deleteDefect) {
      KnownDefectRegistry.annotate(testInfo, deleteDefect);
      test.fail(true, `${deleteDefect.id}: ${deleteDefect.title}`);
    }

    await test.step('Admin deletes the updated user', async () => {
      await app.userManagement.deleteUser(originalUser.email);
    });
  },
);
