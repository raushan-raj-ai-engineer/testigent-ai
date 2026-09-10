/** Capture a local Playwright storage state for a configured project. */
import { chromium } from '@playwright/test';
import { createInterface } from 'node:readline/promises';
import path from 'node:path';
import { intelligenceFlags } from '../src/framework/intelligence/core/flags.js';
import { ApplicationRegistry } from '../src/framework/core/config/application.registry.js';
import { ensureStorageStateDirectory } from '../src/framework/intelligence/exploration/auth.state.js';

async function main(): Promise<void> {
  if (!intelligenceFlags.explorationEnabled()) throw new Error('APPLICATION_EXPLORATION_ENABLED is false.');
  if (!process.stdin.isTTY) throw new Error('app:auth requires an interactive terminal.');
  const app = process.env.APP?.trim();
  if (!app) throw new Error(`APP is required. Available projects: ${ApplicationRegistry.listProjects().join(', ')}`);
  const env = process.env.ENV ?? 'qa';
  const cfg = ApplicationRegistry.projectConfig(app, env);
  const base = process.env.APP_BASE_URL?.trim() || cfg.application.uiBaseUrl;
  const configured = process.env.PW_STORAGE_STATE?.trim() || cfg.auth?.storageStatePath || `.auth/${app}.exploration.json`;
  const statePath = path.isAbsolute(configured) ? configured : path.resolve(configured);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try { await rl.question(`Login to '${app}' in the browser. When authentication is complete, press ENTER here to save session state.\n`); }
    finally { rl.close(); }
    await ensureStorageStateDirectory(statePath);
    await context.storageState({ path: statePath });
    console.log(`Auth state saved locally: ${statePath}`);
    console.log('Security: auth state is gitignored because it can contain session secrets.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
