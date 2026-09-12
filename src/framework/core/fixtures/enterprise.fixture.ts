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
import { RuntimeConfig, type ResolvedRuntimeConfig } from '../config/runtime.config';
import { optionalDatabaseSkipReason, requiresDatabaseCapability } from '../config/capability.policy';
import { RunContext } from '../config/run.context';
import { installSessionStorageSnapshot, readSessionStorageSnapshot, resolveAuthStatePaths } from '../auth.state';

export interface EnterpriseFixtures {
  runtime: ResolvedRuntimeConfig;
  apiClient: BaseApiClient;
  db: DatabaseClient;
  data: DataFactory;
  dataScope: DataScope;
  logger: EnterpriseLogger;
  healer: HealingOrchestrator;
  _capabilityGate: void;
  _authStateBootstrap: void;
}

/**
 * Reusable dependency-injection boundary.
 * Project tests should normally consume project facades (`app`, `api`, `repositories`) rather than
 * constructing framework services. Direct framework fixtures remain available to project fixture adapters.
 */
export const test = base.extend<EnterpriseFixtures>({
  runtime: async ({}, use) => { await use(RuntimeConfig.resolve()); },

  page: async ({ page }, use, testInfo) => {
    await use(page);
    const actualFailure = testInfo.status === 'failed' || testInfo.status === 'timedOut' || testInfo.errors.length > 0;
    if (!actualFailure || page.isClosed()) return;
    try {
      const screenshotPath = testInfo.outputPath('testigent-failure.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await testInfo.attach('failure-screenshot', { path: screenshotPath, contentType: 'image/png' });
    } catch (error) {
      testInfo.annotations.push({
        type: 'evidence-warning',
        description: `Unable to capture final failure screenshot: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  },

  _capabilityGate: [async ({ runtime }, use, testInfo) => {
    if (requiresDatabaseCapability(testInfo.titlePath, testInfo.tags)) {
      const reason = optionalDatabaseSkipReason(runtime.capabilities.database);
      if (reason) testInfo.skip(true, reason);
    }
    await use();
  }, { auto: true }],

  _authStateBootstrap: [async ({ context, runtime }, use) => {
    if (runtime.auth.strategy === 'storageState') {
      const paths = resolveAuthStatePaths(runtime.auth);
      const snapshot = paths.sessionStoragePath ? readSessionStorageSnapshot(paths.sessionStoragePath) : undefined;
      await installSessionStorageSnapshot(context, snapshot);
    }
    await use();
  }, { auto: true }],


  logger: async ({ runtime }, use, testInfo) => {
    const logger = new EnterpriseLogger({
      runId: RunContext.get().runId,
      testId: testInfo.testId,
      title: testInfo.title,
      environment: runtime.environment,
      application: runtime.applicationName,
      workerIndex: testInfo.workerIndex,
      parallelIndex: testInfo.parallelIndex,
    });
    await use(logger);
  },

  data: async ({}, use) => { await use(new DataFactory()); },

  dataScope: async ({ runtime }, use, testInfo) => {
    const scope = new DataScope({
      runId: RunContext.get().runId,
      application: runtime.applicationName,
      environment: runtime.environment,
      testId: testInfo.testId,
      retry: testInfo.retry,
      parallelIndex: testInfo.parallelIndex,
      caseId: testInfo.annotations.find(item => item.type === 'caseId')?.description,
    });
    await use(scope);
  },

  db: async ({ logger, runtime }, use) => {
    const rawDb = DatabaseFactory.create(runtime.capabilities.database.enabled ? runtime.capabilities.database.type : 'none');
    const db = new ObservedDatabaseClient(rawDb, logger.child({ layer: 'DATABASE' }));
    try { await use(db); } finally { await db.close(); }
  },

  apiClient: async ({ request, logger, runtime }, use, testInfo) => {
    const client = new BaseApiClient(
      request,
      runtime.application.apiBaseUrl,
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
      () => createAiGateway(testInfo.testId),
      testInfo.testId,
    );
    try { await use(healer); } finally { await browserLogs.attachIfUseful(); }
  },
});

export { expect };
