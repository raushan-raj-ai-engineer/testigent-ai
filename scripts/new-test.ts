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
  const seed = `projects/${process.env.APP ?? '<selected-project>'}/tests/_agent/seed.spec.ts`;
  const planPath = join(outDir, 'test-plan.json');
  const plan = JSON.parse(await readFile(planPath, 'utf8')) as { layers?: string[] };
  const layers = Array.isArray(plan.layers) ? plan.layers : [];
  const layerLabel = layers.length ? layers.join(' + ') : 'OTHER';
  const layerGuidance = authoringGuidance(layers);
  const prompt = `# TestigentAI Automation Authoring Prompt

Author: Raushan Raj

Use ${mode.toUpperCase()} and approved project evidence to implement requirement **${requirementId}**.

Target automation layers: **${layerLabel}**

## Non-negotiable framework rules
1. Read generation-manifest.json, AUTOMATION_PROPOSAL.md, test-plan.json and the generated/reused project abstractions first.
2. Use the selected project's agent seed (${seed}) as the architectural entry point. UI exploration inherits project configuration/auth/fixtures from that seed.
3. Collect evidence appropriate to each layer; never invent UI details, URLs, API routes, payload fields, credentials, database tables/columns, SQL semantics or expected business results.
4. Final business specs consume project fixtures/facades (app, api, repositories, data) and contain business intent + test.step(). Never construct framework services directly.
5. UI mechanics stay in Page Objects. Every executable UI action uses LocatorPlan + HealingOrchestrator (or BasePage healing helpers). Workflows own reusable journeys.
6. UI recovery order is primary locator -> deterministic fallback -> semantically validated cache -> lazy AI fallback. AI is created only when deterministic recovery is exhausted.
7. API services own routes, typed payloads and response mapping. Business specs do not use raw APIRequestContext and agents must not change expected status/business contracts to make tests green.
8. Database repositories own parameterized SQL. Agent-authored DB validation is read-only by default; destructive DDL/DML is prohibited unless an explicit human-approved project policy says otherwise.
9. Runtime recovery may repair infrastructure/transient conditions only when business intent can still be deterministically proven. Source healing is review-only and must never weaken assertions, authorization/security rules or data-integrity expectations.
10. Keep GENERATED PROPOSAL ownership header until proposal promotion. Remove REVIEW_REQUIRED/test.fixme only after evidence-based implementation and human review.
11. Finish with npm run architecture:check, npm run typecheck, npm run test:authoring:contract, and npm run proposal:validate -- ${requirementId}.

## Layer-specific authoring guidance
${layerGuidance}

## Human approval gate
Generated automation is a proposal, never trusted production automation by default:
- npm run proposal:show -- ${requirementId}
- npm run proposal:validate -- ${requirementId}
- npm run proposal:approve -- ${requirementId} --reviewer="<name>"
- npm run proposal:promote -- ${requirementId}

## Tool policy
- Planner: convert requirement + approved evidence into business scenarios and layer coverage.
- CLI/MCP: preferred for UI/browser evidence; use the project seed and never bypass application auth policy.
- API evidence: prefer approved OpenAPI/Swagger/Postman/contracts or observed project service behavior. Do not guess undocumented endpoints.
- Database evidence: prefer approved schema/data dictionary/migrations or project repository patterns. Do not guess identifiers.
- Generator: map evidence into Page / Workflow / API Service / Repository -> project Facade -> business spec.
- Healer: diagnose locator/scoping/synchronization drift and propose source maintenance; runtime UI healing remains governed by TestigentAI.
`;
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


function authoringGuidance(layers: string[]): string {
  const output: string[] = [];
  if (layers.includes('UI')) {
    output.push('- **UI:** inspect the live application with Playwright CLI/MCP/Test Agents; place selectors and LocatorPlan metadata in Page Objects; validate every healed action with a semantic post-condition.');
  }
  if (layers.includes('API')) {
    output.push('- **API:** derive routes, methods, auth, payloads, schemas and expected statuses from approved API evidence; generate positive/negative/boundary/contract coverage only when supported by the requirement or contract.');
  }
  if (layers.includes('DATABASE')) {
    output.push('- **DATABASE:** derive tables/columns/relationships from approved schema evidence; keep SQL parameterized in repositories; use SELECT/read-only validation by default and never auto-correct schema drift.');
  }
  if (layers.length > 1) {
    output.push('- **Cross-layer E2E:** correlate one business identity across layers (for example transaction/customer/reference id) and prove the same business outcome through API/UI/DB without duplicating framework infrastructure.');
  }
  if (!output.length) output.push('- **Other:** keep the proposal review-gated and collect deterministic evidence before implementation.');
  return output.join('\n');
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exit(1); });
