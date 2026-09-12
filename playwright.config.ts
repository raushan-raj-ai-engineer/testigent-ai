import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';
import { RuntimeConfig, type SupportedBrowser } from './src/framework/core/config/runtime.config';
import { RunContext } from './src/framework/core/config/run.context';
import { requiredTagGroupsToRegExp, tagsToRegExp } from './src/framework/core/execution/execution.policy';
import { resolveVisualEvidencePolicy } from './src/framework/logging/evidence.policy';

RunContext.ensure();
const runtime = RuntimeConfig.resolve();
const policy = runtime.execution;
const baseURL = process.env.APP_BASE_URL?.trim() || runtime.application.uiBaseUrl;
const configuredStorageState = process.env.PW_STORAGE_STATE?.trim() || runtime.auth.storageStatePath;
const storageState = configuredStorageState
  ? (path.isAbsolute(configuredStorageState) ? configuredStorageState : path.resolve(configuredStorageState))
  : undefined;
const usableStorageState = storageState && fs.existsSync(storageState) ? storageState : undefined;
const reportRoot = runtime.reportRoot;
const resultRoot = runtime.resultRoot;
const visualEvidencePolicy = resolveVisualEvidencePolicy();
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
    toHaveScreenshot: { maxDiffPixelRatio: runtime.playwright.visualMaxDiffPixelRatio },
  },
  grep: profileGrep,
  grepInvert: profileGrepInvert,
  forbidOnly: !!process.env.CI,
  retries: policy.retries,
  workers: policy.workers,
  maxFailures: policy.maxFailures || undefined,
  reporter: process.env.CI
    ? [
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
    storageState: usableStorageState,
    trace: visualEvidencePolicy === 'standard' ? runtime.playwright.trace : 'off',
    screenshot: visualEvidencePolicy === 'standard' ? runtime.playwright.screenshot : 'off',
    video: visualEvidencePolicy === 'standard' ? runtime.playwright.video : 'off',
    actionTimeout: policy.actionTimeoutMs,
    navigationTimeout: policy.navigationTimeoutMs,
    ignoreHTTPSErrors: runtime.playwright.ignoreHTTPSErrors,
    ...(process.env.PW_WS_ENDPOINT?.trim()
      ? { connectOptions: { wsEndpoint: process.env.PW_WS_ENDPOINT.trim(), timeout: runtime.playwright.wsConnectTimeoutMs } }
      : {}),
  },
  projects: runtime.playwright.browsers.map(browser => browserProject(browser, usableStorageState)),
});

function browserProject(
  browser: SupportedBrowser,
  storageState: string | undefined,
): NonNullable<PlaywrightTestConfig['projects']>[number] {
  switch (browser) {
    case 'chromium': return { name: 'chromium', use: { ...devices['Desktop Chrome'], storageState } };
    case 'firefox': return { name: 'firefox', use: { ...devices['Desktop Firefox'], storageState } };
    case 'webkit': return { name: 'webkit', use: { ...devices['Desktop Safari'], storageState } };
  }
}
