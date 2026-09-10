import 'dotenv/config';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { ApplicationRegistry } from './src/framework/core/config/application.registry';

const appName = process.env.APP?.trim() || 'demo';
const app = ApplicationRegistry.get(appName);
const baseURL = process.env.APP_BASE_URL?.trim() || app.uiBaseUrl;
const storageState = process.env.PW_STORAGE_STATE?.trim() || undefined;
const reportRoot = path.join('reports', appName);
const resultRoot = path.join('test-results', appName);

export default defineConfig({
  testDir: '.',
  testMatch: ['tests/framework/**/*.spec.ts', 'projects/**/tests/**/*.spec.ts'],
  globalSetup: './src/framework/core/setup/global.setup.ts',
  outputDir: resultRoot,
  fullyParallel: true,
  timeout: Number(process.env.TEST_TIMEOUT_MS ?? 60_000),
  expect: { timeout: Number(process.env.EXPECT_TIMEOUT_MS ?? 10_000) },
  forbidOnly: !!process.env.CI,
  retries: Number(process.env.PW_RETRIES ?? (process.env.CI ? 1 : 0)),
  workers: process.env.PW_WORKERS ? Number(process.env.PW_WORKERS) : process.env.CI ? 4 : undefined,
  maxFailures: process.env.CI ? Number(process.env.PW_MAX_FAILURES ?? 50) : undefined,
  reporter: process.env.CI
    ? [
        ['blob', { outputDir: process.env.PLAYWRIGHT_BLOB_OUTPUT_DIR ?? path.join(reportRoot, 'blob-report') }],
        ['./src/framework/reporting/business.reporter.ts', { outputDir: path.join(reportRoot, 'business') }],
      ]
    : [
        ['list'],
        ['html', { outputFolder: path.join(reportRoot, 'playwright-html'), open: 'never' }],
        ['./src/framework/reporting/business.reporter.ts', { outputDir: path.join(reportRoot, 'business') }],
      ],
  use: {
    baseURL,
    storageState,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: Number(process.env.ACTION_TIMEOUT_MS ?? 15_000),
    navigationTimeout: Number(process.env.NAVIGATION_TIMEOUT_MS ?? 30_000),
    ignoreHTTPSErrors: false,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
