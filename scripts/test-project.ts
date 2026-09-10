import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { projectPreflight } from './project-check';

try {
  const info = projectPreflight();
  const args = ['playwright', 'test', info.testDir, ...process.argv.slice(2)];
  const env: NodeJS.ProcessEnv = { ...process.env, ENV: info.environment, APP: info.application };
  if (info.storageState) env.PW_STORAGE_STATE = info.storageState;
  else delete env.PW_STORAGE_STATE;
  const result = spawnSync('npx', args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
