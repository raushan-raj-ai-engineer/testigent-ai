/** CLI: safe automated application exploration for selected project. */
import { intelligenceFlags } from '../src/framework/intelligence/core/flags.js';
import { safeExplore } from '../src/framework/intelligence/exploration/app.explorer.js';
import { ApplicationRegistry } from '../src/framework/core/config/application.registry.js';

async function main(): Promise<void> {
  if (!intelligenceFlags.explorationEnabled()) throw new Error('APPLICATION_EXPLORATION_ENABLED is false.');
  const app = process.env.APP?.trim(); if (!app) throw new Error('APP is required.');
  const base = process.env.APP_BASE_URL?.trim() || ApplicationRegistry.get(app).uiBaseUrl;
  console.log(JSON.stringify(await safeExplore(process.cwd(), base), null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
