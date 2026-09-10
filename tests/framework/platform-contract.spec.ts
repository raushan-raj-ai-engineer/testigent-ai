import { expect, test } from '@playwright/test';
import { EnvironmentConfigManager } from '../../src/framework/core/config/environment.config';
import { ApplicationRegistry } from '../../src/framework/core/config/application.registry';
import { NullDatabaseClient } from '../../src/framework/database/null.database';

test.describe('platform integration contract', () => {
  test('sdet-practice is resolved from QA application registry', async () => {
    const previousEnv = process.env.ENV;
    try {
      process.env.ENV = 'qa';
      EnvironmentConfigManager.resetForTest();
      const app = ApplicationRegistry.get('sdet-practice');
      expect(app.uiBaseUrl).toBe('https://sdet-practice-app.onrender.com');
      expect(app.apiBaseUrl).toBeTruthy();
    } finally {
      previousEnv === undefined ? delete process.env.ENV : process.env.ENV = previousEnv;
      EnvironmentConfigManager.resetForTest();
    }
  });

  test('disabled database keeps the common query signature and fails explicitly', async () => {
    const db = new NullDatabaseClient();
    await expect(db.query('select 1')).rejects.toThrow(/Database is disabled/);
    await db.close();
  });
});
