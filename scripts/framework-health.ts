import fs from 'node:fs';
import path from 'node:path';
import { RuntimeConfig } from '../src/framework/core/config/runtime.config';

const requiredFiles = [
  'playwright.config.ts',
  'src/framework/core/fixtures/enterprise.fixture.ts',
  'src/framework/reporting/business.reporter.ts',
  'src/framework/reporting/business-html.renderer.ts',
  'src/framework/notifications/mail.notification.ts',
  'src/framework/healing/healing.orchestrator.ts',
  'src/framework/intelligence/generation/framework.generator.ts',
  'src/framework/intelligence/review/proposal.review.ts',
  'src/framework/core/execution/execution.policy.ts',
  'src/framework/data/data-scope.ts',
  'src/framework/execution/duration-history.store.ts',
  'src/framework/declarative/scenario.runner.ts',
  'src/framework/evaluation/evaluation.runner.ts',
  'src/framework/quality/accessibility.smoke.ts',
  'src/framework/quality/performance.budget.ts',
  'src/framework/quality/visual.assertion.ts',
];

const missing = requiredFiles.filter(file => !fs.existsSync(path.resolve(file)));
if (missing.length) throw new Error(`Framework health check failed. Missing: ${missing.join(', ')}`);

const runtime = RuntimeConfig.resolve();
const appName = runtime.applicationName;
const app = runtime.application;
if (!/^https?:\/\//.test(app.uiBaseUrl)) throw new Error(`Invalid UI base URL for ${appName}: ${app.uiBaseUrl}`);
if (!/^https?:\/\//.test(app.apiBaseUrl)) throw new Error(`Invalid API base URL for ${appName}: ${app.apiBaseUrl}`);
if (runtime.capabilities.database.required && !runtime.capabilities.database.enabled) {
  const database = runtime.capabilities.database;
  const detail = database.type === 'none' ? 'database type is none' : `missing: ${database.missingConfiguration.join(', ')}`;
  throw new Error(`Required database capability is unavailable for ${appName}/${runtime.environment} (${detail}).`);
}

console.log(JSON.stringify({
  ok: true,
  environment: runtime.environment,
  application: appName,
  uiBaseUrl: app.uiBaseUrl,
  apiBaseUrl: app.apiBaseUrl,
  capabilities: runtime.capabilities,
  requiredFiles: requiredFiles.length,
}, null, 2));
