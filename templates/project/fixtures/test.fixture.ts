import { test as frameworkTest, expect } from '../../../src/framework/core/fixtures/enterprise.fixture';
import { ProjectAppFacade } from '../src/app.facade';
import { ProjectApiFacade } from '../src/api/api.facade';
import { ProjectRepositoryFacade } from '../src/database/database.facade';

type ProjectFixtures = {
  app: ProjectAppFacade;
  api: ProjectApiFacade;
  repositories: ProjectRepositoryFacade;
};

/** Project-owned dependency injection. Business tests consume only these domain-facing fixtures plus safe test data. */
export const test = frameworkTest.extend<ProjectFixtures>({
  app: async ({ page, healer }, use) => { await use(new ProjectAppFacade(page, healer)); },
  api: async ({ apiClient }, use) => { await use(new ProjectApiFacade(apiClient)); },
  repositories: async ({ db }, use) => { await use(new ProjectRepositoryFacade(db)); },
});

export { expect };
