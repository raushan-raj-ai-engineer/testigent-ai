import { test as frameworkTest, expect } from '../../../src/framework/core/fixtures/enterprise.fixture';
import { SdetPracticeAppFacade } from '../src/app.facade';

type SdetPracticeFixtures = { app: SdetPracticeAppFacade };

export const test = frameworkTest.extend<SdetPracticeFixtures>({
  app: async ({ page, healer }, use) => { await use(new SdetPracticeAppFacade(page, healer)); },
});

export { expect };
