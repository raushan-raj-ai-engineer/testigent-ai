/** Capture and verify a local Playwright authentication state for a configured project. */
import { chromium } from '@playwright/test';
import { createInterface } from 'node:readline/promises';
import fs from 'node:fs';
import path from 'node:path';
import { intelligenceFlags } from '../src/framework/intelligence/core/flags.js';
import { ApplicationRegistry } from '../src/framework/core/config/application.registry.js';
import { WorkspaceContext } from '../src/framework/core/config/workspace.context.js';
import {
  captureSessionStorage,
  installSessionStorageSnapshot,
  resolveAuthStatePaths,
  writeSessionStorageSnapshot,
} from '../src/framework/core/auth.state.js';
import { verifyAuthenticatedPage } from '../src/framework/core/auth.verifier.js';

async function main(): Promise<void> {
  if (!intelligenceFlags.explorationEnabled()) throw new Error('APPLICATION_EXPLORATION_ENABLED is false.');
  if (!process.stdin.isTTY) throw new Error('app:auth requires an interactive terminal.');

  const target = WorkspaceContext.resolve();
  const app = target.application;
  const env = target.environment;
  const cfg = ApplicationRegistry.projectConfig(app, env);
  const auth = cfg.auth ?? { strategy: 'none' as const };
  if (auth.strategy !== 'storageState') throw new Error(`Project '${app}' does not use storageState authentication.`);

  const base = process.env.APP_BASE_URL?.trim() || cfg.application.uiBaseUrl;
  const paths = resolveAuthStatePaths(auth);
  if (!paths.storageStatePath || !paths.sessionStoragePath) throw new Error(`Project '${app}' requires a configured storageStatePath.`);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      await rl.question(`Login to '${app}'. After the authenticated application is fully visible, press ENTER here.\n`);
    } finally {
      rl.close();
    }

    await page.waitForLoadState('domcontentloaded').catch(() => undefined);
    const currentVerification = await verifyAuthenticatedPage(page, auth.verification);
    if (!currentVerification.ok) {
      throw new Error(`Authentication was not complete when ENTER was pressed: ${currentVerification.reason ?? 'verification failed'}`);
    }

    const tempStorage = `${paths.storageStatePath}.tmp-${process.pid}`;
    const tempSession = `${paths.sessionStoragePath}.tmp-${process.pid}`;
    fs.mkdirSync(path.dirname(paths.storageStatePath), { recursive: true });
    await context.storageState({ path: tempStorage });
    const sessionSnapshot = await captureSessionStorage(page);
    writeSessionStorageSnapshot(tempSession, sessionSnapshot);

    // Prove the captured state works in a new context before replacing the last known-good auth state.
    const verifyContext = await browser.newContext({ storageState: tempStorage });
    await installSessionStorageSnapshot(verifyContext, sessionSnapshot);
    const verifyPage = await verifyContext.newPage();
    try {
      await verifyPage.goto(base, { waitUntil: 'domcontentloaded' });
      const freshVerification = await verifyAuthenticatedPage(verifyPage, auth.verification);
      if (!freshVerification.ok) {
        throw new Error(
          `Captured authentication cannot be restored in a fresh browser context: ${freshVerification.reason ?? 'verification failed'}. ` +
          `No auth state was promoted.`,
        );
      }
    } finally {
      await verifyContext.close();
    }

    fs.copyFileSync(tempStorage, paths.storageStatePath);
    fs.copyFileSync(tempSession, paths.sessionStoragePath);
    fs.rmSync(tempStorage, { force: true });
    fs.rmSync(tempSession, { force: true });
    console.log(`Auth state verified and saved locally: ${paths.storageStatePath}`);
    console.log(`Session storage companion saved locally: ${paths.sessionStoragePath}`);
    console.log('Security: auth files are gitignored because they can contain session secrets.');
  } finally {
    // Remove failed temporary captures without deleting a previously verified auth state.
    for (const candidate of [
      `${paths.storageStatePath}.tmp-${process.pid}`,
      `${paths.sessionStoragePath}.tmp-${process.pid}`,
    ]) {
      try { if (fs.existsSync(candidate)) fs.rmSync(candidate, { force: true }); } catch { /* best effort */ }
    }
    await browser.close();
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
