import { test as base, expect } from '@playwright/test';
import { BaseApiClient } from '../../api/base-api.client';
import { DataFactory } from '../../data/data.factory';
import { DataScope } from '../../data/data-scope';
import type { DatabaseClient } from '../../database/database.client';
import { DatabaseFactory } from '../../database/database.factory';
import { ObservedDatabaseClient } from '../../database/observed.database';
import { createAiGateway } from '../../ai/ai-provider.factory';
import { HealingOrchestrator } from '../../healing/healing.orchestrator';
import { EnterpriseLogger } from '../../logging/enterprise.logger';
import { BrowserObservability } from '../../logging/browser.observability';
import { ApplicationRegistry } from '../config/application.registry';
import { EnvironmentConfigManager } from '../config/environment.config';
import { RunContext } from '../config/run.context';

export interface EnterpriseFixtures {
  apiClient: BaseApiClient;
  db: DatabaseClient;
  data: DataFactory;
  dataScope: DataScope;
  logger: EnterpriseLogger;
  healer: HealingOrchestrator;
}

/**
 * Reusable dependency-injection boundary.
 * It intentionally exposes framework capabilities only; project-specific facades
 * are added by projects/<project>/fixtures/test.fixture.ts.
 */
export const test = base.extend<EnterpriseFixtures>({
  logger: async ({}, use, testInfo) => {
    const logger = new EnterpriseLogger({
      runId: RunContext.get().runId,
      testId: testInfo.testId,
      title: testInfo.title,
      environment: EnvironmentConfigManager.load().environment,
      application: process.env.APP ?? 'demo',
      workerIndex: testInfo.workerIndex,
      parallelIndex: testInfo.parallelIndex,
    });
    await use(logger);
  },

  data: async ({}, use) => { await use(new DataFactory()); },

  dataScope: async ({}, use, testInfo) => {
    const scope = new DataScope({
      runId: RunContext.get().runId,
      application: process.env.APP ?? 'demo',
      environment: process.env.ENV ?? 'qa',
      testId: testInfo.testId,
      retry: testInfo.retry,
      parallelIndex: testInfo.parallelIndex,
      caseId: testInfo.annotations.find(item => item.type === 'caseId')?.description,
    });
    await use(scope);
  },

  db: async ({ logger }, use) => {
    const rawDb = DatabaseFactory.create();
    const db = new ObservedDatabaseClient(rawDb, logger.child({ layer: 'DATABASE' }));
    try { await use(db); } finally { await db.close(); }
  },

  apiClient: async ({ request, logger }, use, testInfo) => {
    const client = new BaseApiClient(
      request,
      ApplicationRegistry.current().apiBaseUrl,
      logger.child({ layer: 'API' }),
      testInfo,
    );
    await use(client);
  },

  healer: async ({ page, logger }, use, testInfo) => {
    const browserLogs = new BrowserObservability(page, logger.child({ layer: 'BROWSER' }), testInfo);
    browserLogs.start();
    const healer = new HealingOrchestrator(
      page,
      logger.child({ layer: 'UI_HEALING' }),
      createAiGateway(testInfo.testId),
      testInfo.testId,
    );
    try { await use(healer); } finally { await browserLogs.attachIfUseful(); }
  },
});

export { expect };
