import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveProviderOrder } from '../src/framework/ai/ai-provider.factory';
import { writePortfolioDashboard, type PortfolioSummaryDocument } from '../src/framework/reporting/portfolio-dashboard.writer';
import {
  parseProjectEnvironmentMap,
  resolveMultiProjectTargets,
  splitProjectList,
  type MultiProjectTarget,
} from '../src/framework/core/execution/multi-project';

interface RunnerOptions {
  all: boolean;
  apps: string[];
  group?: string;
  environment?: string;
  environmentMap: Record<string, string>;
  profile?: string;
  includeAi: boolean;
  failFast: boolean;
  dryRun: boolean;
  passthrough: string[];
}

interface ProjectRunResult extends MultiProjectTarget {
  status: 'passed' | 'failed' | 'planned';
  exitCode: number;
  reportPath?: string;
  selected?: number;
  qualityFailed?: number;
  ciBlockingIssues?: number;
  executed?: number;
  notApplicable?: number;
  blocked?: number;
  knownDefects?: number;
  healed?: number;
  aiCalls?: number;
  qualityPassRate?: number;
  gate?: string;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const plan = resolveMultiProjectTargets({
    all: options.all,
    apps: options.apps,
    group: options.group,
    environment: options.environment,
    environmentMap: options.environmentMap,
  });
  printPlan(plan, options);
  if (options.includeAi && !options.dryRun) preflightAi();

  if (options.dryRun) {
    writeSummary(plan.map(item => ({ ...item, status: 'planned', exitCode: 0 })), options, true);
    return;
  }

  const results: ProjectRunResult[] = [];
  for (const target of plan) {
    const result = runProject(target, options);
    results.push(result);
    if (result.status === 'failed' && options.failFast) break;
  }

  const summary = writeSummary(results, options, false);
  printSummary(summary);
  if (results.some(result => result.status === 'failed')) process.exitCode = 1;
}

function parseArgs(argv: string[]): RunnerOptions {
  const options: RunnerOptions = {
    all: false,
    apps: [],
    environmentMap: {},
    includeAi: false,
    failFast: false,
    dryRun: false,
    passthrough: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--all') { options.all = true; continue; }
    if (arg === '--include-ai') { options.includeAi = true; continue; }
    if (arg === '--fail-fast') { options.failFast = true; continue; }
    if (arg === '--dry-run') { options.dryRun = true; continue; }

    const apps = takeValue(argv, index, arg, '--apps');
    if (apps) { options.apps = splitProjectList(apps.value); index = apps.nextIndex; continue; }
    const group = takeValue(argv, index, arg, '--group');
    if (group) { options.group = group.value.trim(); index = group.nextIndex; continue; }
    const environment = takeValue(argv, index, arg, '--env');
    if (environment) { options.environment = environment.value.trim(); index = environment.nextIndex; continue; }
    const envMap = takeValue(argv, index, arg, '--env-map');
    if (envMap) { options.environmentMap = parseProjectEnvironmentMap(envMap.value); index = envMap.nextIndex; continue; }
    const profile = takeValue(argv, index, arg, '--profile');
    if (profile) {
      options.profile = profile.value.trim();
      options.passthrough.push(`--profile=${options.profile}`);
      index = profile.nextIndex;
      continue;
    }
    options.passthrough.push(arg);
  }

  const selectors = Number(options.all) + Number(options.apps.length > 0) + Number(Boolean(options.group));
  if (selectors !== 1) {
    throw new Error(
      'Choose exactly one project selector: --all, --apps=<a,b>, or --group=<name>.\n' +
      'Examples:\n' +
      '  npm run test:projects -- --all --env=qa --profile=regression --project=chromium\n' +
      '  npm run test:projects -- --apps=portal,payments --env-map=portal:qa,payments:uat --project=chromium\n' +
      '  npm run test:projects -- --group=customer-a --profile=nightly --include-ai --project=chromium',
    );
  }
  return options;
}

function runProject(target: MultiProjectTarget, options: RunnerOptions): ProjectRunResult {
  console.log(`\n${'='.repeat(84)}\n[TestigentAI portfolio] ${target.application}/${target.environment}\n${'='.repeat(84)}`);
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    APP: target.application,
    ENV: target.environment,
    ...(options.profile ? { TEST_PROFILE: options.profile } : {}),
    ...(options.includeAi ? { ALLOW_AI_TESTS: 'true' } : {}),
  };
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['run', 'test:project', '--', ...options.passthrough], {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  const exitCode = result.status ?? 1;
  const reportPath = path.resolve('reports', target.application, 'business', 'business-report.json');
  return {
    ...target,
    status: exitCode === 0 ? 'passed' : 'failed',
    exitCode,
    reportPath: fs.existsSync(reportPath) ? path.relative(process.cwd(), reportPath) : undefined,
    ...readReportFacts(reportPath),
  };
}

function readReportFacts(file: string): Pick<ProjectRunResult,
  'selected' | 'executed' | 'notApplicable' | 'blocked' | 'qualityFailed' | 'ciBlockingIssues' |
  'knownDefects' | 'healed' | 'aiCalls' | 'qualityPassRate' | 'gate'> {
  if (!fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
    const healing = asRecord(parsed.healing);
    const aiUsage = asRecord(parsed.aiUsage);
    const qualityGate = asRecord(parsed.qualityGate);
    return {
      selected: finiteNumber(parsed.total),
      executed: finiteNumber(parsed.executed),
      notApplicable: finiteNumber(parsed.notApplicable),
      blocked: finiteNumber(parsed.blockedSkipped),
      qualityFailed: finiteNumber(parsed.qualityFailed),
      ciBlockingIssues: finiteNumber(parsed.ciBlockingIssues),
      knownDefects: finiteNumber(parsed.knownDefects),
      healed: finiteNumber(healing?.count),
      aiCalls: finiteNumber(aiUsage?.calls),
      qualityPassRate: finiteNumber(parsed.qualityPassRate),
      gate: typeof parsed.gate === 'string'
        ? parsed.gate
        : typeof qualityGate?.status === 'string'
          ? qualityGate.status
          : undefined,
    };
  } catch {
    return {};
  }
}

function writeSummary(results: ProjectRunResult[], options: RunnerOptions, dryRun: boolean): {
  file: string;
  dashboard: string;
  totalProjects: number;
  passedProjects: number;
  failedProjects: number;
  selectedScenarios: number;
  executedScenarios: number;
  notApplicable: number;
  blocked: number;
  qualityFailed: number;
  ciBlockingIssues: number;
  knownDefects: number;
  healed: number;
  aiCalls: number;
} {
  const totals = {
    totalProjects: results.length,
    passedProjects: results.filter(result => result.status === 'passed').length,
    failedProjects: results.filter(result => result.status === 'failed').length,
    selectedScenarios: results.reduce((sum, result) => sum + (result.selected ?? 0), 0),
    executedScenarios: results.reduce((sum, result) => sum + (result.executed ?? 0), 0),
    notApplicable: results.reduce((sum, result) => sum + (result.notApplicable ?? 0), 0),
    blocked: results.reduce((sum, result) => sum + (result.blocked ?? 0), 0),
    qualityFailed: results.reduce((sum, result) => sum + (result.qualityFailed ?? 0), 0),
    ciBlockingIssues: results.reduce((sum, result) => sum + (result.ciBlockingIssues ?? 0), 0),
    knownDefects: results.reduce((sum, result) => sum + (result.knownDefects ?? 0), 0),
    healed: results.reduce((sum, result) => sum + (result.healed ?? 0), 0),
    aiCalls: results.reduce((sum, result) => sum + (result.aiCalls ?? 0), 0),
  };
  const reportDirectory = path.resolve('reports', 'multi-project');
  const file = path.join(reportDirectory, 'summary.json');
  const document: PortfolioSummaryDocument = {
    generatedAt: new Date().toISOString(),
    dryRun,
    selection: options.all ? 'all' : options.group ? `group:${options.group}` : `apps:${options.apps.join(',')}`,
    profile: options.profile ?? process.env.TEST_PROFILE ?? 'custom',
    includeAi: options.includeAi,
    failFast: options.failFast,
    totals,
    projects: results,
  };
  fs.mkdirSync(reportDirectory, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(document, null, 2));
  const dashboard = writePortfolioDashboard(reportDirectory, document);
  return {
    file: path.relative(process.cwd(), file),
    dashboard: path.relative(process.cwd(), dashboard),
    ...totals,
  };
}

function printPlan(plan: MultiProjectTarget[], options: RunnerOptions): void {
  console.log(`[portfolio] projects=${plan.length} profile=${options.profile ?? process.env.TEST_PROFILE ?? 'custom'} include-ai=${options.includeAi} fail-fast=${options.failFast}`);
  for (const target of plan) console.log(`  - ${target.application}/${target.environment}`);
  if (options.dryRun) console.log('[portfolio] dry-run=true; no tests will execute.');
}

function printSummary(summary: ReturnType<typeof writeSummary>): void {
  console.log(`\n[TestigentAI portfolio summary]`);
  console.log(`  Projects: ${summary.totalProjects} | Passed: ${summary.passedProjects} | Failed: ${summary.failedProjects}`);
  console.log(`  Business scenarios: ${summary.selectedScenarios} | Executed: ${summary.executedScenarios} | Not applicable: ${summary.notApplicable} | Blocked: ${summary.blocked}`);
  console.log(`  Quality failed: ${summary.qualityFailed} | Known defects: ${summary.knownDefects} | CI-blocking: ${summary.ciBlockingIssues}`);
  console.log(`  Validated healing: ${summary.healed} | AI calls: ${summary.aiCalls}`);
  console.log(`  Summary: ${summary.file}`);
  console.log(`  Business dashboard: ${summary.dashboard}`);
}

function preflightAi(): void {
  if (process.env.AI_ENABLED !== 'true') {
    throw new Error(
      '--include-ai requires AI_ENABLED=true. Configure an approved provider before portfolio execution so AI-tagged tests cannot fail part-way through the estate.',
    );
  }
  const providers = resolveProviderOrder();
  console.log(`[portfolio] AI provider preflight passed: ${providers.join(' -> ')}`);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function takeValue(argv: string[], index: number, arg: string, name: string): { value: string; nextIndex: number } | undefined {
  if (arg.startsWith(`${name}=`)) {
    const value = arg.slice(name.length + 1);
    if (!value) throw new Error(`${name} requires a value.`);
    return { value, nextIndex: index };
  }
  if (arg !== name) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return { value, nextIndex: index + 1 };
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
