import 'dotenv/config';
/** Simple framework-safe new-test entrypoint. Author: Raushan Raj */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

async function exists(path: string): Promise<boolean> { try { await access(path); return true; } catch { return false; } }
function run(root: string, args: string[], env: NodeJS.ProcessEnv = {}): void {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const r = spawnSync(npm, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

async function main(): Promise<void> {
  const root = process.cwd();
  const requirementArg = process.argv.slice(2).find(arg => !arg.startsWith('--'));
  const mode = (process.argv.find(arg => arg.startsWith('--mode='))?.split('=')[1] ?? 'cli').toLowerCase();
  if (!requirementArg) throw new Error('Usage: npm run test:new -- projects/<project>/requirements/<feature>.md [--mode=cli|mcp|agents]');
  const requirement = resolve(root, requirementArg);
  if (!(await exists(requirement))) throw new Error(`Requirement file not found: ${requirementArg}`);

  run(root, ['run', 'requirement:analyze', '--', requirementArg]);
  run(root, ['run', 'requirement:test-plan', '--', requirementArg]);
  run(root, ['run', 'requirement:generate', '--', requirementArg], { TEST_GENERATION_ENABLED: 'true' });
  run(root, ['run', 'requirement:validate-generated']);

  const requirementId = basename(requirementArg).replace(/\.[^.]+$/, '');
  const outDir = join(root, 'generated', 'requirements', requirementId);
  await mkdir(outDir, { recursive: true });
  const promptPath = join(outDir, 'PLAYWRIGHT_AUTHORING_PROMPT.md');
  const prompt = `# Playwright Framework Authoring Prompt\n\nAuthor: Raushan Raj\n\nUse ${mode.toUpperCase()} to inspect the live application and implement requirement **${requirementId}**.\n\n## Non-negotiable framework rules\n1. Read generation-manifest.json, AUTOMATION_PROPOSAL.md and the generated Page/Workflow/spec first.\n2. Use Playwright CLI/MCP/Test Agent browser evidence to validate locators and flows; never invent UI details.\n3. Tests contain business intent + test.step(), never raw page.locator/getByRole/click/fill.\n4. Page Objects own UI mechanics. Every executable UI action uses LocatorPlan + HealingOrchestrator (or BasePage healingClick/healingFill helpers).\n5. Scope modal/component plans so healing cannot jump to a same-named control elsewhere on the page.\n6. Deterministic primary/fallback first; AI healing only through AiGateway/HealingOrchestrator.\n7. Do not heal business assertions, API 4xx/5xx, wrong DB state, authorization defects or expected-result mismatches.\n8. Keep GENERATED PROPOSAL ownership header until proposal promotion. Remove REVIEW_REQUIRED/test.fixme only after live validation.\n9. Finish with npm run typecheck, npm run test:authoring:contract, and npm run proposal:validate -- ${requirementId}.\n\n## Tool preference\n- CLI: use playwright-cli snapshots/codegen/generate-locator for token-efficient authoring.\n- MCP: use Playwright MCP when persistent structured browser exploration is more useful.\n- Agents: planner -> Markdown plan, generator -> implementation, healer -> repair; still obey this framework contract.\n`;
  await writeFile(promptPath, prompt, 'utf8');

  if ((process.env.AUTHORING_PRODUCTIVITY_ENABLED ?? 'true').toLowerCase() === 'true') {
    run(root, ['run', 'authoring:start', '--', requirementId, mode]);
  }

  console.log(`\nNEW TEST WORKSPACE READY\nRequirement: ${requirementId}\nMode: ${mode}\nPrompt: ${promptPath}`);
  console.log('\nNext: give PLAYWRIGHT_AUTHORING_PROMPT.md to your coding agent, then run:');
  console.log(`  npm run proposal:show -- ${requirementId}`);
  console.log('  npm run test:authoring:contract');
  console.log(`  npm run authoring:complete -- ${requirementId}   # after implementation/validation`);
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
