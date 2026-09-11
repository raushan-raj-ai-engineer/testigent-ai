import fs from 'node:fs';
import path from 'node:path';
import type {
  ExecutionConfigLayer,
  ExecutionProfileName,
  ExecutionSettings,
  ResolvedExecutionPolicy,
  TestLane,
  WorkerSetting,
} from './execution.types';

const PROFILE_NAMES: ExecutionProfileName[] = ['pr', 'smoke', 'regression', 'nightly', 'release', 'custom'];
const LANES: TestLane[] = ['ui', 'api', 'db', 'e2e', 'ai', 'visual', 'accessibility', 'performance'];

const DEFAULTS: ResolvedExecutionPolicy = {
  profile: 'custom',
  workers: '50%',
  retries: 0,
  maxFailures: 50,
  fullyParallel: true,
  timeoutMs: 60_000,
  expectTimeoutMs: 10_000,
  actionTimeoutMs: 15_000,
  navigationTimeoutMs: 30_000,
  includeTags: [],
  excludeTags: [],
  allowedLanes: [...LANES],
  allowAi: false,
  allowGenerated: false,
  allowManual: false,
  durationBalancing: 'native',
  sources: ['framework-defaults'],
};

export interface ExecutionPolicyInput {
  root?: string;
  application?: string;
  environment?: string;
  profile?: ExecutionProfileName;
  lane?: TestLane;
  cli?: ExecutionSettings;
  env?: NodeJS.ProcessEnv;
}

/**
 * Author: Raushan Raj
 * Business use: Resolves execution behavior through organization -> project -> environment -> CLI precedence.
 * Why reusable: Every project receives the same deterministic policy engine while retaining local overrides.
 * Safety: Custom profiles deny AI/manual/generated execution unless an explicit higher-precedence layer allows it.
 */
export function resolveExecutionPolicy(input: ExecutionPolicyInput = {}): ResolvedExecutionPolicy {
  const root = input.root ?? process.cwd();
  const env = input.env ?? process.env;
  const application = input.application ?? env.APP?.trim() ?? 'demo';
  const environment = input.environment ?? env.ENV?.trim() ?? 'qa';
  const profile = parseProfile(input.profile ?? env.TEST_PROFILE ?? env.EXECUTION_PROFILE ?? 'custom');
  const lane = parseOptionalLane(input.lane ?? env.TEST_LANE);

  let settings: ExecutionSettings = { ...DEFAULTS };
  const sources: string[] = [...DEFAULTS.sources];

  const organization = readLayer(path.join(root, 'config', 'organization.json'));
  ({ settings } = mergeLayer(settings, organization, profile, 'organization', sources));

  const project = readLayer(path.join(root, 'projects', application, 'project.json'));
  ({ settings } = mergeLayer(settings, project, profile, `project:${application}`, sources));

  const environmentLayer = readLayer(path.join(root, 'projects', application, 'config', `${environment}.json`));
  ({ settings } = mergeLayer(settings, environmentLayer, profile, `environment:${environment}`, sources));

  settings = mergeSettings(settings, environmentOverrides(env));
  if (hasEnvironmentOverrides(env)) sources.push('environment-variables');

  if (input.cli && Object.keys(input.cli).length > 0) {
    settings = mergeSettings(settings, input.cli);
    sources.push('cli');
  }

  // Safe custom profile rule: permissive flags must be explicit, never inherited accidentally from defaults.
  if (profile === 'custom') {
    if (!explicitBoolean(env.ALLOW_AI_TESTS) && input.cli?.allowAi === undefined) settings.allowAi = false;
    if (!explicitBoolean(env.ALLOW_GENERATED_TESTS) && input.cli?.allowGenerated === undefined) settings.allowGenerated = false;
    if (!explicitBoolean(env.ALLOW_MANUAL_TESTS) && input.cli?.allowManual === undefined) settings.allowManual = false;
  }

  const allowedLanes = settings.allowedLanes?.length ? dedupe(settings.allowedLanes) : [...LANES];
  if (lane && !allowedLanes.includes(lane)) {
    throw new Error(`Execution lane '${lane}' is not allowed by profile '${profile}'. Allowed lanes: ${allowedLanes.join(', ')}`);
  }

  const excludeTags = dedupe([
    ...(settings.excludeTags ?? []),
    ...(settings.allowAi ? [] : ['@ai']),
    ...(settings.allowGenerated ? [] : ['@generated', '@generated-review']),
    ...(settings.allowManual ? [] : ['@manual']),
  ]);

  return {
    profile,
    lane,
    workers: parseWorkers(settings.workers ?? DEFAULTS.workers),
    retries: integerAtLeast(settings.retries, 0, DEFAULTS.retries),
    maxFailures: integerAtLeast(settings.maxFailures, 0, DEFAULTS.maxFailures),
    fullyParallel: settings.fullyParallel ?? DEFAULTS.fullyParallel,
    timeoutMs: positiveInteger(settings.timeoutMs, DEFAULTS.timeoutMs),
    expectTimeoutMs: positiveInteger(settings.expectTimeoutMs, DEFAULTS.expectTimeoutMs),
    actionTimeoutMs: positiveInteger(settings.actionTimeoutMs, DEFAULTS.actionTimeoutMs),
    navigationTimeoutMs: positiveInteger(settings.navigationTimeoutMs, DEFAULTS.navigationTimeoutMs),
    includeTags: dedupe(settings.includeTags ?? []),
    excludeTags,
    allowedLanes,
    allowAi: settings.allowAi ?? false,
    allowGenerated: settings.allowGenerated ?? false,
    allowManual: settings.allowManual ?? false,
    durationBalancing: settings.durationBalancing === 'history' ? 'history' : 'native',
    sources,
  };
}

/** Parses Playwright worker values while preserving supported percentage syntax such as `50%`. */
export function parseWorkers(value: unknown): WorkerSetting {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 1) throw new Error(`PW_WORKERS must be a positive integer or percentage, received: ${value}`);
    return value;
  }
  const text = String(value ?? '').trim();
  if (/^\d+%$/.test(text)) {
    const percent = Number(text.slice(0, -1));
    if (percent < 1 || percent > 100) throw new Error(`PW_WORKERS percentage must be between 1% and 100%, received: ${text}`);
    return text as WorkerSetting;
  }
  const numeric = Number(text);
  if (Number.isInteger(numeric) && numeric >= 1) return numeric;
  throw new Error(`PW_WORKERS must be a positive integer or percentage, received: ${text || '(empty)'}`);
}

/** Returns true when the selected lane needs browser storage state for projects that require UI authentication. */
export function laneRequiresBrowserAuth(lane?: TestLane): boolean {
  return lane === undefined || ['ui', 'e2e', 'visual', 'accessibility', 'performance'].includes(lane);
}

/** Converts configured tag strings into an OR expression accepted by Playwright `grep`/`grepInvert`. */
export function tagsToRegExp(tags: string[]): RegExp | undefined {
  const normalized = dedupe(tags.map(tag => tag.trim()).filter(Boolean));
  if (!normalized.length) return undefined;
  return new RegExp(`(?:${normalized.map(tagTokenPattern).join('|')})`);
}

/**
 * Builds an AND-of-ORs grep expression. Each inner group is alternative tags; every non-empty group must match.
 * Business use: a profile requirement such as `@smoke` and a lane requirement such as `@lane:api|@api`
 * stay enforced together instead of one CLI/config grep accidentally replacing the other.
 */
export function requiredTagGroupsToRegExp(groups: string[][]): RegExp | undefined {
  const normalized = groups
    .map(group => dedupe(group.map(tag => tag.trim()).filter(Boolean)))
    .filter(group => group.length > 0);
  if (!normalized.length) return undefined;
  return new RegExp(normalized.map(group => `(?=.*(?:${group.map(tagTokenPattern).join('|')}))`).join(''));
}

function readLayer(file: string): ExecutionConfigLayer {
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as ExecutionConfigLayer;
  } catch (error) {
    throw new Error(`Invalid execution configuration '${file}': ${error instanceof Error ? error.message : String(error)}`);
  }
}

function mergeLayer(
  current: ExecutionSettings,
  layer: ExecutionConfigLayer,
  profile: ExecutionProfileName,
  source: string,
  sources: string[],
): { settings: ExecutionSettings } {
  let settings = current;
  let used = false;
  if (layer.execution) { settings = mergeSettings(settings, layer.execution); used = true; }
  const profileSettings = layer.profiles?.[profile];
  if (profileSettings) { settings = mergeSettings(settings, profileSettings); used = true; }
  if (used) sources.push(source);
  return { settings };
}

function mergeSettings(base: ExecutionSettings, override?: ExecutionSettings): ExecutionSettings {
  if (!override) return { ...base };
  return {
    ...base,
    ...override,
    includeTags: override.includeTags ?? base.includeTags,
    excludeTags: override.excludeTags ?? base.excludeTags,
    allowedLanes: override.allowedLanes ?? base.allowedLanes,
  };
}

function environmentOverrides(env: NodeJS.ProcessEnv): ExecutionSettings {
  const settings: ExecutionSettings = {};
  if (env.PW_WORKERS?.trim()) settings.workers = parseWorkers(env.PW_WORKERS);
  if (env.PW_RETRIES?.trim()) settings.retries = parseIntegerEnv('PW_RETRIES', env.PW_RETRIES, 0);
  if (env.PW_MAX_FAILURES?.trim()) settings.maxFailures = parseIntegerEnv('PW_MAX_FAILURES', env.PW_MAX_FAILURES, 0);
  if (env.TEST_TIMEOUT_MS?.trim()) settings.timeoutMs = parseIntegerEnv('TEST_TIMEOUT_MS', env.TEST_TIMEOUT_MS, 1);
  if (env.EXPECT_TIMEOUT_MS?.trim()) settings.expectTimeoutMs = parseIntegerEnv('EXPECT_TIMEOUT_MS', env.EXPECT_TIMEOUT_MS, 1);
  if (env.ACTION_TIMEOUT_MS?.trim()) settings.actionTimeoutMs = parseIntegerEnv('ACTION_TIMEOUT_MS', env.ACTION_TIMEOUT_MS, 1);
  if (env.NAVIGATION_TIMEOUT_MS?.trim()) settings.navigationTimeoutMs = parseIntegerEnv('NAVIGATION_TIMEOUT_MS', env.NAVIGATION_TIMEOUT_MS, 1);
  const ai = explicitBoolean(env.ALLOW_AI_TESTS); if (ai !== undefined) settings.allowAi = ai;
  const generated = explicitBoolean(env.ALLOW_GENERATED_TESTS); if (generated !== undefined) settings.allowGenerated = generated;
  const manual = explicitBoolean(env.ALLOW_MANUAL_TESTS); if (manual !== undefined) settings.allowManual = manual;
  if (env.DURATION_BALANCING === 'history' || env.DURATION_BALANCING === 'native') settings.durationBalancing = env.DURATION_BALANCING;
  return settings;
}

function hasEnvironmentOverrides(env: NodeJS.ProcessEnv): boolean {
  return ['PW_WORKERS', 'PW_RETRIES', 'PW_MAX_FAILURES', 'TEST_TIMEOUT_MS', 'EXPECT_TIMEOUT_MS', 'ACTION_TIMEOUT_MS',
    'NAVIGATION_TIMEOUT_MS', 'ALLOW_AI_TESTS', 'ALLOW_GENERATED_TESTS', 'ALLOW_MANUAL_TESTS', 'DURATION_BALANCING']
    .some(name => env[name] !== undefined);
}

function explicitBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (/^(1|true|yes|on)$/i.test(value.trim())) return true;
  if (/^(0|false|no|off)$/i.test(value.trim())) return false;
  throw new Error(`Expected boolean environment value, received '${value}'.`);
}

function parseProfile(value: string): ExecutionProfileName {
  const normalized = value.trim().toLowerCase() as ExecutionProfileName;
  if (!PROFILE_NAMES.includes(normalized)) throw new Error(`Unknown execution profile '${value}'. Expected: ${PROFILE_NAMES.join(', ')}`);
  return normalized;
}

function parseOptionalLane(value: string | undefined): TestLane | undefined {
  if (!value?.trim()) return undefined;
  const normalized = value.trim().toLowerCase() as TestLane;
  if (!LANES.includes(normalized)) throw new Error(`Unknown execution lane '${value}'. Expected: ${LANES.join(', ')}`);
  return normalized;
}

function parseIntegerEnv(name: string, value: string, minimum: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) throw new Error(`${name} must be an integer >= ${minimum}, received '${value}'.`);
  return parsed;
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return integerAtLeast(value, 1, fallback);
}

function integerAtLeast(value: number | undefined, minimum: number, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < minimum) throw new Error(`Expected integer >= ${minimum}, received '${value}'.`);
  return value;
}

function dedupe<T>(values: T[]): T[] { return [...new Set(values)]; }
function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function tagTokenPattern(value: string): string { return `${escapeRegExp(value)}(?=\\s|$)`; }
