import 'dotenv/config';
import { RuntimeConfig } from '../src/framework/core/config/runtime.config';
import { AuthManager } from '../src/framework/core/auth.manager';

async function main(): Promise<void> {
  const checkOnly = process.argv.includes('--check');
  const runtime = RuntimeConfig.resolve();
  const manager = new AuthManager(runtime);
  const result = await manager.prepareForRun({
    required: runtime.auth.strategy === 'storageState' && runtime.auth.required !== false,
    allowRefresh: !checkOnly,
  });
  const payload = { ...manager.describe(), ...result, mode: checkOnly ? 'check' : 'prepare' };
  console.log(JSON.stringify(payload, null, 2));
  if (!result.ready) {
    throw new Error(result.reason ?? 'Authentication is not ready.');
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
