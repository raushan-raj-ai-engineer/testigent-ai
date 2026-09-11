import 'dotenv/config';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { ApplicationRegistry } from './src/framework/core/config/application.registry';
import { requiredTagGroupsToRegExp, resolveExecutionPolicy, tagsToRegExp } from './src/framework/core/execution/execution.policy';

const appName = process.env.APP?.trim() || 'demo';
const environment = process.env.ENV?.trim() || 'qa';
const app = ApplicationRegistry.get(appName, environment);
const policy = resolveExecutionPolicy({ application: appName, environment });
const baseURL = process.env.APP_BASE_URL?.trim() || app.uiBaseUrl;
const storageState = process.env.PW_STORAGE_STATE?.trim() || undefined;
const reportRoot = path.join('reports', appName);
const resultRoot = path.join('test-results', appName);
const profileGrep = requiredTagGroupsToRegExp([
  policy.includeTags,
  policy.lane ? [`@lane:${policy.lane}`, `@${policy.lane}`] : [],
]);
const profileGrepInvert = tagsToRegExp(policy.excludeTags);

export default defineConfig({
  testDir: '.',
  testMatch: ['tests/framework/**/*.spec.ts', 'projects/**/tests/**/*.spec.ts'],
  globalSetup: './src/framework/core/setup/global.setup.ts',
  outputDir: resultRoot,
  fullyParallel: policy.fullyParallel,
  timeout: policy.timeoutMs,
  expect: {
    timeout: policy.expectTimeoutMs,
    toHaveScreenshot: { maxDiffPixelRatio: Number(process.env.VISUAL_MAX_DIFF_RATIO ?? 0.01) },
  },
  grep: profileGrep,
  grepInvert: profileGrepInvert,
  forbidOnly: !!process.env.CI,
  retries: policy.retries,
  workers: policy.workers,
  maxFailures: policy.maxFailures || undefined,
  reporter: process.env.CI
    ? [
        // Keep a concise console reporter in CI so failed shard/test names and errors are visible in GitHub logs.
        ['line'],
        ['blob', { outputDir: process.env.PLAYWRIGHT_BLOB_OUTPUT_DIR ?? path.join(reportRoot, 'blob-report') }],
        ['./src/framework/reporting/business.reporter.ts', { outputDir: path.join(reportRoot, 'business') }],
        ['./src/framework/execution/duration-history.reporter.ts'],
      ]
    : [
        ['list'],
        ['html', { outputFolder: path.join(reportRoot, 'playwright-html'), open: 'never' }],
        ['./src/framework/reporting/business.reporter.ts', { outputDir: path.join(reportRoot, 'business') }],
        ['./src/framework/execution/duration-history.reporter.ts'],
      ],
  use: {
    baseURL,
    storageState,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: policy.actionTimeoutMs,
    navigationTimeout: policy.navigationTimeoutMs,
    ignoreHTTPSErrors: false,
    ...(process.env.PW_WS_ENDPOINT?.trim()
      ? { connectOptions: { wsEndpoint: process.env.PW_WS_ENDPOINT.trim(), timeout: Number(process.env.PW_WS_TIMEOUT_MS ?? 30_000) } }
      : {}),
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
