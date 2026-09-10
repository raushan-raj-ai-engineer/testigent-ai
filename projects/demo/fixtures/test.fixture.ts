import type { Page } from '@playwright/test';
import { test as frameworkTest, expect } from '../../../src/framework/core/fixtures/enterprise.fixture';
import { DemoAppFacade } from '../src/app.facade';
import { DemoApiFacade } from '../src/api/api.facade';

type DemoFixtures = {
  app: DemoAppFacade;
  api: DemoApiFacade;
};

export const test = frameworkTest.extend<DemoFixtures>({
  app: async ({ page, healer }, use) => { await use(new DemoAppFacade(page as Page, healer)); },
  api: async ({ apiClient }, use) => { await use(new DemoApiFacade(apiClient)); },
});

export { expect };
