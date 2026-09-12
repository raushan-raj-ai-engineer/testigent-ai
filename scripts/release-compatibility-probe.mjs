import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { chromium, firefox, webkit } from '@playwright/test';
const require = createRequire(import.meta.url);
const playwrightPackage = require('@playwright/test/package.json');

const browserName = (process.env.COMPAT_BROWSER ?? '').trim().toLowerCase();
const launchers = { chromium, firefox, webkit };
const launcher = launchers[browserName];
if (!launcher) throw new Error(`COMPAT_BROWSER must be one of ${Object.keys(launchers).join(', ')}.`);

const browser = await launcher.launch({ headless: true });
let browserVersion;
try { browserVersion = browser.version(); } finally { await browser.close(); }

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  node: process.version,
  npm: process.env.npm_config_user_agent ?? 'unknown',
  platform: process.platform,
  architecture: process.arch,
  osRelease: os.release(),
  playwright: playwrightPackage.version,
  browser: browserName,
  browserVersion,
};
const outDir = path.resolve('reports', 'release-compatibility');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `${process.platform}-${process.arch}-${browserName}.json`);
fs.writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8');
console.log(JSON.stringify({ ok: true, file: path.relative(process.cwd(), out), ...payload }, null, 2));
