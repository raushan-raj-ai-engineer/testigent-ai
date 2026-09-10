import { spawnSync } from 'node:child_process';

/**
 * Author: Raushan Raj
 * Business Use: Preflight validation for Playwright CLI, MCP and native agent commands.
 * How to use: npm run agents:check before configuring coding-agent workflows.
 * Benefit: Detects missing agent tooling without starting browsers or consuming LLM tokens.
 */
const checks = [
  { name: 'Playwright Test', args: ['playwright', '--version'] },
  { name: 'Playwright CLI', args: ['playwright-cli', '--help'] },
  { name: 'Playwright MCP', args: ['playwright-mcp', '--help'] }
];
let failed = false;
for (const check of checks) {
  const result = spawnSync('npx', check.args, { encoding: 'utf8', shell: process.platform === 'win32' });
  if (result.status === 0) console.log(`[PASS] ${check.name}`);
  else { failed = true; console.error(`[FAIL] ${check.name}: ${(result.stderr || result.stdout).trim().slice(0, 400)}`); }
}
console.log('\nNative Playwright agent definitions can be generated with: npx playwright init-agents --loop=codex|vscode|claude|opencode');
if (failed) process.exitCode = 1;
