import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import YAML from 'yaml';
import {
  declarativeScenarioSchema,
  SCENARIO_SCHEMA_VERSION,
  SUPPORTED_ARIA_ROLES,
  SUPPORTED_LOCATOR_STRATEGIES,
} from '../src/framework/declarative/scenario.schema';
import {
  assertCapabilityCatalogMatchesSchema,
  DECLARATIVE_CAPABILITIES,
  TYPESCRIPT_REQUIRED_GUIDANCE,
} from '../src/framework/declarative/scenario.capabilities';
import { discoverDeclarativeScenarios } from '../src/framework/declarative/scenario.discovery';
import { loadDeclarativeScenario } from '../src/framework/declarative/scenario.loader';
import { buildDeclarativeJsonSchema } from '../src/framework/declarative/scenario.json-schema';
import { WorkspaceContext } from '../src/framework/core/config/workspace.context';

const SCHEMA_PATH = path.resolve('schemas/testigent-scenario.schema.json');

async function main(): Promise<void> {
  const [command = 'help', ...args] = process.argv.slice(2);
  switch (command) {
    case 'help': printHelp(); return;
    case 'list': listScenarios(args); return;
    case 'validate': validateScenarios(args); return;
    case 'new': await createScenario(args); return;
    case 'schema': generateSchema(args.includes('--check')); return;
    case 'doctor': doctor(args); return;
    case 'run': runScenario(args); return;
    default:
      throw new Error(`Unknown scenario command '${command}'. Run "npm run scenario:help".`);
  }
}

function printHelp(): void {
  assertCapabilityCatalogMatchesSchema();
  console.log('TestigentAI Declarative UI Authoring');
  console.log('===================================');
  console.log('\nUse YAML when the flow is linear, deterministic, UI-only, and expressible by the allow-listed actions below.');
  for (const category of ['navigation', 'interaction', 'assertion'] as const) {
    console.log(`\n${category.toUpperCase()}`);
    for (const item of DECLARATIVE_CAPABILITIES.filter(capability => capability.category === category)) {
      console.log(`  ${item.name.padEnd(14)} ${item.purpose}`);
      console.log(`  ${''.padEnd(14)} example: ${item.example}`);
    }
  }
  console.log('\nLOCATORS');
  console.log(`  ${SUPPORTED_LOCATOR_STRATEGIES.join(', ')}`);
  console.log(`  role values: ${SUPPORTED_ARIA_ROLES.join(', ')}`);
  console.log('  Prefer role, label, text, and testId. CSS is an advanced fallback.');

  console.log('\nUSE TYPESCRIPT INSTEAD WHEN YOU NEED');
  for (const item of TYPESCRIPT_REQUIRED_GUIDANCE) console.log(`  - ${item}`);

  console.log('\nCOMMANDS');
  console.log('  npm run scenario:new -- --app demo --name "Create todo" --url /');
  console.log('  npm run scenario:list -- --app demo');
  console.log('  npm run scenario:validate -- --app demo');
  console.log('  npm run scenario:validate -- projects/demo/data/scenarios/todo-smoke.yaml');
  console.log('  npm run scenario:run -- --app demo --id todo-low-code-001');
  console.log('  npm run scenario:doctor -- --app demo');
  console.log('  npm run scenario:schema');
}

function listScenarios(args: string[]): void {
  const flags = parseArgs(args);
  const app = resolveApp(flags.app);
  const scenarios = discoverDeclarativeScenarios(app);
  if (!scenarios.length) {
    console.log(`No declarative scenarios found for app '${app}'.`);
    return;
  }
  for (const item of scenarios) {
    const relative = path.relative(process.cwd(), item.filePath);
    console.log(`${item.scenario.id}\t${item.scenario.title}\t${item.scenario.tags.join(' ')}\t${relative}`);
  }
  console.log(`\n${scenarios.length} scenario(s).`);
}

function validateScenarios(args: string[]): void {
  const flags = parseArgs(args);
  const fileArg = args.find(arg => !arg.startsWith('--') && arg !== flags.app);
  if (fileArg) {
    const scenario = loadDeclarativeScenario(fileArg);
    console.log(`PASS ${scenario.id}: ${fileArg}`);
    return;
  }
  const app = resolveApp(flags.app);
  const scenarios = discoverDeclarativeScenarios(app);
  if (!scenarios.length) throw new Error(`No declarative scenarios found under projects/${app}/data/scenarios.`);
  for (const item of scenarios) console.log(`PASS ${item.scenario.id}: ${path.relative(process.cwd(), item.filePath)}`);
  console.log(`Declarative validation: ${scenarios.length} scenario(s), 0 issues.`);
}

async function createScenario(args: string[]): Promise<void> {
  const flags = parseArgs(args);
  const interactive = process.stdin.isTTY && process.stdout.isTTY;
  const rl = interactive ? createInterface({ input, output }) : undefined;
  try {
    const selected = flags.app ?? process.env.APP?.trim() ?? WorkspaceContext.read()?.application;
    const appInput = selected ?? (rl ? await rl.question('Application: ') : undefined);
    const app = appInput?.trim();
    if (!app) throw new Error('Application is required. Run npm run qa:use -- <project> <environment> or pass --app <project>.');
    const title = flags.name ?? (rl ? await rl.question('Scenario title: ') : undefined);
    if (!title?.trim()) throw new Error('Scenario title is required. Use --name "..." in non-interactive mode.');
    const id = flags.id ?? slugify(title);
    const startUrlInput = flags.url ?? (rl ? await rl.question('Application-relative start path [/]: ') : '/');
    const startUrl = startUrlInput || '/';
    const scenarioDirectory = path.resolve('projects', app, 'data', 'scenarios');
    fs.mkdirSync(scenarioDirectory, { recursive: true });
    const destination = path.join(scenarioDirectory, `${id}.yaml`);
    if (fs.existsSync(destination) && flags.force !== 'true') throw new Error(`${destination} already exists. Use --force to replace it.`);

    const schemaRelative = normalizePath(path.relative(path.dirname(destination), SCHEMA_PATH));
    const scenario = {
      schemaVersion: SCENARIO_SCHEMA_VERSION,
      kind: 'ui',
      id,
      title: title.trim(),
      tags: ['@smoke'],
      steps: [
        { action: 'goto', url: startUrl },
        { action: 'expectVisible', by: 'role', role: 'heading', name: 'REPLACE_ME' },
      ],
    };
    declarativeScenarioSchema.parse(scenario);
    const text = `# yaml-language-server: $schema=${schemaRelative}\n${YAML.stringify(scenario, { lineWidth: 120 })}`;
    fs.writeFileSync(destination, text);
    console.log(`Created ${path.relative(process.cwd(), destination)}`);
    console.log('Next: replace REPLACE_ME, then run npm run scenario:validate -- <file>.');
  } finally {
    rl?.close();
  }
}

function generateSchema(checkOnly: boolean): void {
  const generated = buildDeclarativeJsonSchema();
  const expected = `${JSON.stringify(generated, null, 2)}\n`;
  if (checkOnly) {
    const actual = fs.existsSync(SCHEMA_PATH) ? fs.readFileSync(SCHEMA_PATH, 'utf8') : '';
    if (actual !== expected) throw new Error('Declarative JSON Schema is missing or stale. Run npm run scenario:schema.');
    console.log('Declarative JSON Schema is current.');
    return;
  }
  fs.mkdirSync(path.dirname(SCHEMA_PATH), { recursive: true });
  fs.writeFileSync(SCHEMA_PATH, expected);
  console.log(`Generated ${path.relative(process.cwd(), SCHEMA_PATH)}`);
}

function doctor(args: string[]): void {
  const flags = parseArgs(args);
  const app = resolveApp(flags.app);
  assertCapabilityCatalogMatchesSchema();
  generateSchema(true);
  // Declarative authoring is optional per project: validate every scenario that exists, but do not force teams to adopt YAML.
  const scenarios = discoverDeclarativeScenarios(app);
  const settingsPath = path.resolve('.vscode/settings.json');
  if (!fs.existsSync(settingsPath)) throw new Error('.vscode/settings.json is required for schema-driven YAML autocomplete.');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
  if (!settings['yaml.schemas']) throw new Error('.vscode/settings.json does not configure yaml.schemas.');
  console.log(`Scenario doctor: PASS (${scenarios.length} scenario(s), schema current, capability catalog aligned, VS Code schema association present).`);
  if (!scenarios.length) console.log(`Declarative authoring is available for '${app}' but optional; create one with npm run scenario:new -- --app ${app} --name \"My scenario\".`);
}

function runScenario(args: string[]): void {
  const flags = parseArgs(args);
  const app = resolveApp(flags.app);
  const scenarios = discoverDeclarativeScenarios(app);
  const explicitFile = flags.file;
  const explicitId = flags.id;
  let selected = explicitFile
    ? scenarios.find(item => path.resolve(item.filePath) === path.resolve(explicitFile))
    : scenarios.find(item => item.scenario.id === explicitId);

  if (!selected && explicitFile) selected = { filePath: path.resolve(explicitFile), scenario: loadDeclarativeScenario(explicitFile) };
  if (!selected) throw new Error('Select one scenario with --id <scenario-id> or --file <path>. Run npm run scenario:list first.');

  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['run', 'test:project', '--', '--project=chromium', '--grep', `@scenario:${selected.scenario.id}`], {
    stdio: 'inherit',
    env: {
      ...process.env,
      APP: app,
      TEST_PROFILE: 'custom',
      SCENARIO_FILE: selected.filePath,
    },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

function parseArgs(args: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith('--')) continue;
    const [rawKey, inline] = arg.slice(2).split('=', 2);
    const next = args[index + 1];
    if (inline !== undefined) flags[rawKey] = inline;
    else if (next && !next.startsWith('--')) { flags[rawKey] = next; index += 1; }
    else flags[rawKey] = 'true';
  }
  return flags;
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'scenario';
}

function normalizePath(value: string): string {
  const normalized = value.split(path.sep).join('/');
  return normalized.startsWith('.') ? normalized : `./${normalized}`;
}


function resolveApp(explicit?: string): string {
  const value = explicit?.trim() || process.env.APP?.trim() || WorkspaceContext.read()?.application;
  if (value) return value;
  return WorkspaceContext.resolve().application;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
