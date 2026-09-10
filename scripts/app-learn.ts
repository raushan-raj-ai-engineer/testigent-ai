/** CLI: human-guided application learning for selected project. */
import { intelligenceFlags } from '../src/framework/intelligence/core/flags.js';
import { guidedLearn } from '../src/framework/intelligence/exploration/app.explorer.js';
import { ApplicationRegistry } from '../src/framework/core/config/application.registry.js';

async function main(): Promise<void> {
  if (!intelligenceFlags.explorationEnabled()) throw new Error('APPLICATION_EXPLORATION_ENABLED is false.');
  const app = process.env.APP?.trim(); if (!app) throw new Error('APP is required.');
  const journey = process.argv.slice(2).join(' ').trim() || process.env.EXPLORATION_JOURNEY_NAME || 'Guided business journey';
  const base = process.env.APP_BASE_URL?.trim() || ApplicationRegistry.get(app).uiBaseUrl;
  console.log(JSON.stringify(await guidedLearn(process.cwd(), base, journey), null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
