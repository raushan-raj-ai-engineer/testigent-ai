import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { projectPreflight } from './project-check';
import { RuntimeConfig } from '../src/framework/core/config/runtime.config';
import { AuthManager } from '../src/framework/core/auth.manager';
import { laneRequiresBrowserAuth, requiredTagGroupsToRegExp, resolveExecutionPolicy, tagsToRegExp } from '../src/framework/core/execution/execution.policy';
import { mergeGovernedFilters } from '../src/framework/core/execution/execution.cli-filters';
import type { ExecutionProfileName, TestLane } from '../src/framework/core/execution/execution.types';

interface CustomArgs { lane?: TestLane; profile?: string; passthrough: string[]; }

/** Runs a project with TestigentAI custom profile/lane options while preserving native Playwright CLI flags. */
async function main(): Promise<void> {
  const custom = parseCustomArgs(process.argv.slice(2));
  if (custom.lane) process.env.TEST_LANE = custom.lane;
  if (custom.profile) process.env.TEST_PROFILE = custom.profile;

  // Prepare/verify auth before Playwright workers are spawned. One refresh can then serve all workers on this runner.
  const runtime = RuntimeConfig.resolve();
  const previewPolicy = resolveRunnerPolicy(runtime.applicationName, runtime.environment, custom.lane, runtime.execution.profile);
  if (laneRequiresBrowserAuth(previewPolicy.lane) && runtime.auth.strategy === 'storageState' && runtime.auth.required !== false) {
    const auth = await new AuthManager(runtime).prepareForRun({ required: true, allowRefresh: true });
    if (!auth.ready) {
      throw new Error(
        `AUTH_PREPARE_FAILED: ${auth.reason ?? 'authentication is not ready'}\n` +
        `Run 'APP=${runtime.applicationName} ENV=${runtime.environment} npm run auth:prepare' or 'npm run qa:auth' for manual capture.`,
      );
    }
  }

  const info = projectPreflight({ lane: custom.lane });
  const policy = resolveRunnerPolicy(info.application, info.environment, info.lane, info.profile);
  const enforcedGrep = requiredTagGroupsToRegExp([
    policy.includeTags,
    info.lane ? [`@lane:${info.lane}`, `@${info.lane}`] : [],
  ]);
  const enforcedGrepInvert = tagsToRegExp(policy.excludeTags);
  const args = ['playwright', 'test', info.testDir, ...mergeGovernedFilters(custom.passthrough, enforcedGrep, enforcedGrepInvert)];

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ENV: info.environment,
    APP: info.application,
    TEST_PROFILE: info.profile,
    ...(info.lane ? { TEST_LANE: info.lane } : {}),
  };
  if (info.storageState) env.PW_STORAGE_STATE = info.storageState;
  else delete env.PW_STORAGE_STATE;

  const result = spawnSync('npx', args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
  process.exitCode = result.status ?? 1;
}

function parseCustomArgs(argv: string[]): CustomArgs {
  const passthrough: string[] = [];
  let lane: TestLane | undefined;
  let profile: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg.startsWith('--lane=')) { const value = arg.slice('--lane='.length); if (!value) throw new Error('--lane requires a value.'); lane = value as TestLane; continue; }
    if (arg === '--lane') {
      const value = argv[++index];
      if (!value || value.startsWith('-')) throw new Error('--lane requires a value.');
      lane = value as TestLane;
      continue;
    }
    if (arg.startsWith('--profile=')) { const value = arg.slice('--profile='.length); if (!value) throw new Error('--profile requires a value.'); profile = value; continue; }
    if (arg === '--profile') {
      const value = argv[++index];
      if (!value || value.startsWith('-')) throw new Error('--profile requires a value.');
      profile = value;
      continue;
    }
    passthrough.push(arg);
  }
  return { lane, profile, passthrough };
}

function resolveRunnerPolicy(
  application: string,
  environment: string,
  lane: TestLane | undefined,
  profile: ExecutionProfileName,
) {
  return resolveExecutionPolicy({ application, environment, lane, profile });
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
