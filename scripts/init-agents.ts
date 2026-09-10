import 'dotenv/config';
import { spawnSync } from 'node:child_process';

const allowed = ['vscode', 'codex', 'claude', 'opencode'] as const;
type AgentLoop = typeof allowed[number];

const requested = (process.argv[2] ?? process.env.PLAYWRIGHT_AGENT_LOOP ?? 'vscode').trim().toLowerCase();
if (!allowed.includes(requested as AgentLoop)) {
  throw new Error(`Unsupported agent loop '${requested}'. Use: ${allowed.join(', ')}.`);
}

const result = spawnSync('npx', ['playwright', 'init-agents', `--loop=${requested}`], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});
if (result.status !== 0) process.exit(result.status ?? 1);
const harden = spawnSync('npx', ['tsx', 'scripts/harden-agent-definitions.ts'], { stdio: 'inherit', shell: process.platform === 'win32' });
if (harden.status !== 0) process.exit(harden.status ?? 1);
console.log(`\nPlaywright Test Agents initialized and enterprise-hardened for '${requested}'. Regenerate after Playwright upgrades.`);
