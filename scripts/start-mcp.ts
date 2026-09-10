import 'dotenv/config';
import { spawnSync } from 'node:child_process';

/** Starts standalone @playwright/mcp using PLAYWRIGHT_MCP_* environment configuration. */
const result = spawnSync('npx', ['playwright-mcp'], {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32'
});
process.exit(result.status ?? 1);
