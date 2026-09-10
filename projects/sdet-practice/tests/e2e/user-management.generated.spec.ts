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
  async ({ page, app }, testInfo) => {
    const uniqueId = `${Date.now()}-${testInfo.workerIndex}-${testInfo.retry}`;
    const originalUser: CreateUserData = {
      name: `Automation User ${uniqueId}`,
      email: `automation-${uniqueId}@example.com`,
      password: 'Test@12345',
    };
    const updatedName = `Updated Automation User ${uniqueId}`;

    await test.step('Admin opens the user management application', async () => {
      await page.goto('/');
    });

    await test.step('Admin creates a new user', async () => {
      await app.userManagement.createUser(originalUser);
    });

    await test.step('Admin updates the created user', async () => {
      await app.userManagement.updateUser(originalUser.email, { name: updatedName });
    });

    // Mark expected failure only after Create + Update have passed. If either regresses,
    // Playwright still reports a real unexpected failure. If Delete starts passing,
    // Playwright reports an unexpected pass so the known-defect entry must be removed.
    if (deleteDefect) test.fail(true, `${deleteDefect.id}: ${deleteDefect.title}`);

    await test.step('Admin deletes the updated user', async () => {
      await app.userManagement.deleteUser(originalUser.email);
    });
  },
);
