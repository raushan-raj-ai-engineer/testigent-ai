import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ApplicationRegistry } from '../src/framework/core/config/application.registry';
import { RuntimeConfig } from '../src/framework/core/config/runtime.config';
import { hasPersistedAuthState, resolveAuthStatePaths } from '../src/framework/core/auth.state';
import { WorkspaceContext } from '../src/framework/core/config/workspace.context';

const [command = 'help', ...args] = process.argv.slice(2);

function main(): void {
  switch (command) {
    case 'help': printHelp(); return;
    case 'use': selectWorkspace(args); return;
    case 'status': printStatus(); return;
    case 'doctor': doctor(); return;
    case 'auth': runNpm(['run', 'app:auth'], { ...selectedEnv(), APPLICATION_EXPLORATION_ENABLED: 'true' }); return;
    case 'new': createNewTest(args); return;
    case 'test': runNpm(['run', 'test:project', '--', ...args], selectedEnv()); return;
    case 'validate': validate(args); return;
    case 'report': runNpm(['run', 'report:open'], selectedEnv()); return;
    case 'agents': initializeAgents(args); return;
    case 'heal': runNpm(['run', 'healing:maintenance'], selectedEnv()); return;
    default: throw new Error(`Unknown qa command '${command}'. Run npm run qa -- help.`);
  }
}

function selectWorkspace(args: string[]): void {
  const application = args[0]?.trim();
  if (!application) throw new Error(`Usage: npm run qa:use -- <project> <environment>\nProjects: ${ApplicationRegistry.listProjects().join(', ') || '(none)'}`);
  const environments = WorkspaceContext.listEnvironments(application);
  if (!environments.length) throw new Error(`Project '${application}' has no environment config.`);
  const environment = args[1]?.trim() || (environments.length === 1 ? environments[0] : undefined);
  if (!environment) throw new Error(`Environment is required for '${application}'. Available: ${environments.join(', ')}`);
  if (!environments.includes(environment)) throw new Error(`Unknown environment '${environment}' for '${application}'. Available: ${environments.join(', ')}`);
  ApplicationRegistry.projectConfig(application, environment);
  const selection = WorkspaceContext.write(application, environment);
  console.log(`Selected ${selection.application}/${selection.environment}`);
  console.log(`Local state: ${path.relative(process.cwd(), WorkspaceContext.file())} (gitignored)`);
}

function printStatus(): void {
  const stored = WorkspaceContext.read();
  const runtime = RuntimeConfig.resolve();
  console.log(JSON.stringify({
    selectedBy: process.env.APP || process.env.ENV ? 'environment/workspace precedence' : stored ? 'workspace' : 'inference',
    application: runtime.applicationName,
    environment: runtime.environment,
    uiBaseUrl: runtime.application.uiBaseUrl,
    apiBaseUrl: runtime.application.apiBaseUrl,
    authStrategy: runtime.auth.strategy,
    browsers: runtime.playwright.browsers,
    profile: runtime.execution.profile,
    capabilities: runtime.capabilities,
  }, null, 2));
}

function doctor(): void {
  const runtime = RuntimeConfig.resolve();
  const required = [
    path.join(runtime.projectRoot, 'config', `${runtime.environment}.json`),
    path.join(runtime.projectRoot, 'fixtures', 'test.fixture.ts'),
    path.join(runtime.projectRoot, 'src', 'app.facade.ts'),
    path.join(runtime.projectRoot, 'tests', '_agent', 'seed.spec.ts'),
  ];
  const missing = required.filter(file => !fs.existsSync(file));
  const authPaths = resolveAuthStatePaths(runtime.auth);
  const storageState = authPaths.storageStatePath;
  const authReady = runtime.auth.strategy !== 'storageState' || runtime.auth.required === false || hasPersistedAuthState(authPaths);

  const databaseReady = !runtime.capabilities.database.required || runtime.capabilities.database.enabled;
  const ok = missing.length === 0 && authReady && databaseReady;
  console.log(JSON.stringify({
    ok,
    application: runtime.applicationName,
    environment: runtime.environment,
    missing: missing.map(file => path.relative(process.cwd(), file)),
    auth: {
      strategy: runtime.auth.strategy,
      required: runtime.auth.required ?? false,
      ready: authReady,
      storageState: storageState ? path.relative(process.cwd(), storageState) : undefined,
    },
    capabilities: runtime.capabilities,
    agentSeed: path.relative(process.cwd(), path.join(runtime.projectRoot, 'tests', '_agent', 'seed.spec.ts')),
    next: missing.length
      ? 'Repair missing project contract files before authoring.'
      : !authReady
        ? 'Create/refresh the configured auth storage state before UI authoring or execution.'
        : !databaseReady
          ? 'Configure the required database capability and secret connection variables before execution.'
          : 'Ready for qa:new / qa:test.',
  }, null, 2));
  if (!ok) process.exitCode = 1;
}

function createNewTest(args: string[]): void {
  const runtime = RuntimeConfig.resolve();
  const modeArg = args.find(arg => arg.startsWith('--mode='));
  const mode = modeArg ?? '--mode=agents';
  const candidate = args.find(arg => !arg.startsWith('--'));
  if (!candidate) {
    throw new Error('Usage: npm run qa:new -- <requirement-id|requirement-file> [--mode=agents|cli|mcp]');
  }
  const requirement = resolveRequirement(runtime.applicationName, candidate);
  runNpm(['run', 'test:new', '--', requirement, mode], selectedEnv());
}

function validate(args: string[]): void {
  const env = selectedEnv();
  const commands: string[][] = [
    ['run', 'release:static'],
    ['run', 'architecture:check'],
    ['run', 'framework:health'],
    ['run', 'scenario:doctor'],
    ['run', 'reporting:contract'],
    ['run', 'typecheck'],
    ['run', 'project:check'],
  ];
  for (const npmArgs of commands) runNpm(npmArgs, env);
  if (args.includes('--with-tests')) runNpm(['run', 'test:project', '--', '--project=chromium'], env);
  console.log(`QA validation passed for ${env.APP}/${env.ENV}${args.includes('--with-tests') ? ' including project tests' : ''}.`);
}

function initializeAgents(args: string[]): void {
  const loop = args[0]?.trim() || process.env.PLAYWRIGHT_AGENT_LOOP || 'vscode';
  runNpm(['run', 'agents:init', '--', loop], selectedEnv());
  const runtime = RuntimeConfig.resolve();
  console.log(`Use seed test: ${path.relative(process.cwd(), path.join(runtime.projectRoot, 'tests', '_agent', 'seed.spec.ts'))}`);
  console.log('Agent flow: planner -> reviewed plan -> generator/evidence -> Testigent architecture mapping -> validation.');
}

function resolveRequirement(application: string, value: string): string {
  const explicit = path.resolve(value);
  if (fs.existsSync(explicit)) return path.relative(process.cwd(), explicit);
  const direct = path.resolve('projects', application, 'requirements', value);
  if (fs.existsSync(direct)) return path.relative(process.cwd(), direct);
  const markdown = path.resolve('projects', application, 'requirements', `${value}.md`);
  if (fs.existsSync(markdown)) return path.relative(process.cwd(), markdown);
  throw new Error(`Requirement '${value}' not found under projects/${application}/requirements.`);
}

function selectedEnv(): NodeJS.ProcessEnv {
  const target = WorkspaceContext.resolve();
  return { ...process.env, APP: target.application, ENV: target.environment };
}

function runNpm(args: string[], env: NodeJS.ProcessEnv): void {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, args, { cwd: process.cwd(), stdio: 'inherit', env, shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function printHelp(): void {
  console.log(`TestigentAI daily workflow\n\n` +
    `  npm run qa:use -- <project> <environment>   Select local project once\n` +
    `  npm run qa:status                            Show resolved configuration\n` +
    `  npm run qa:doctor                            Check project readiness\n` +
    `  npm run qa:auth                              Capture/refresh local auth state\n` +
    `  npm run qa:new -- <requirement>              Prepare agent-assisted test authoring\n` +
    `  npm run qa:test -- [Playwright args]          Run selected project\n` +
    `  npm run qa:validate                           Run static/type/config quality gates\n` +
    `  npm run qa:validate -- --with-tests           Include Chromium project tests\n` +
    `  npm run qa:report                            Open the selected project's report\n` +
    `  npm run qa:agents -- [vscode|codex|claude|opencode]\n` +
    `  npm run qa:heal                              Build source-healing maintenance proposal\n`);
}

try { main(); }
catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
