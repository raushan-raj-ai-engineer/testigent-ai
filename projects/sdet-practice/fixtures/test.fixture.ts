import { test as frameworkTest, expect } from '../../../src/framework/core/fixtures/enterprise.fixture';
import { SdetPracticeAppFacade } from '../src/app.facade';
import { SdetPracticeApiFacade } from '../src/api/api.facade';
import { SdetPracticeRepositoryFacade } from '../src/database/database.facade';

type SdetPracticeFixtures = {
  app: SdetPracticeAppFacade;
  api: SdetPracticeApiFacade;
  repositories: SdetPracticeRepositoryFacade;
};

export const test = frameworkTest.extend<SdetPracticeFixtures>({
  app: async ({ page, healer }, use) => { await use(new SdetPracticeAppFacade(page, healer)); },
  api: async ({ apiClient }, use) => { await use(new SdetPracticeApiFacade(apiClient)); },
  repositories: async ({ db }, use) => { await use(new SdetPracticeRepositoryFacade(db)); },
});

export { expect };
