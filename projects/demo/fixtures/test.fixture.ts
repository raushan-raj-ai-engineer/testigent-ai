import type { Page } from '@playwright/test';
import { test as frameworkTest, expect } from '../../../src/framework/core/fixtures/enterprise.fixture';
import { DemoAppFacade } from '../src/app.facade';
import { DemoApiFacade } from '../src/api/api.facade';
import { DemoRepositoryFacade } from '../src/database/database.facade';

type DemoFixtures = {
  app: DemoAppFacade;
  api: DemoApiFacade;
  repositories: DemoRepositoryFacade;
};

export const test = frameworkTest.extend<DemoFixtures>({
  app: async ({ page, healer }, use) => { await use(new DemoAppFacade(page as Page, healer)); },
  api: async ({ apiClient }, use) => { await use(new DemoApiFacade(apiClient)); },
  repositories: async ({ db }, use) => { await use(new DemoRepositoryFacade(db)); },
});

export { expect };
