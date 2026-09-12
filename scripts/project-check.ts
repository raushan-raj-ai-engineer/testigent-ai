import fs from 'node:fs';
import path from 'node:path';
import { ApplicationRegistry } from '../src/framework/core/config/application.registry';
import { WorkspaceContext } from '../src/framework/core/config/workspace.context';
import { RuntimeConfig } from '../src/framework/core/config/runtime.config';
import type { ResolvedDatabaseCapability } from '../src/framework/core/config/config.types';
import { hasPersistedAuthState, resolveAuthStatePaths } from '../src/framework/core/auth.state';
import { laneRequiresBrowserAuth, resolveExecutionPolicy } from '../src/framework/core/execution/execution.policy';
import type { ExecutionProfileName, TestLane } from '../src/framework/core/execution/execution.types';

export interface ProjectPreflight {
  application: string;
  environment: string;
  testDir: string;
  uiBaseUrl: string;
  apiBaseUrl: string;
  storageState?: string;
  lane?: TestLane;
  profile: ExecutionProfileName;
  database: ResolvedDatabaseCapability;
}

export interface ProjectPreflightOptions {
  requireAuth?: boolean;
  lane?: TestLane;
}

/**
 * Validates one project before Playwright starts, including capability-aware auth requirements.
 * DB/API lanes can run without browser storage state; UI-like lanes still fail fast when authentication is required.
 */
export function projectPreflight(options: ProjectPreflightOptions | boolean = {}): ProjectPreflight {
  const normalized = typeof options === 'boolean' ? { requireAuth: options } : options;
  const target = WorkspaceContext.resolve();
  const application = target.application;
  const environment = target.environment;
  const policy = resolveExecutionPolicy({ application, environment, lane: normalized.lane });
  const config = ApplicationRegistry.projectConfig(application, environment);
  const runtime = RuntimeConfig.resolve();
  const database = runtime.capabilities.database;
  if (database.required && !database.enabled) {
    const detail = database.type === 'none'
      ? 'database type is none'
      : `missing configuration: ${database.missingConfiguration.join(', ')}`;
    throw new Error(`Database capability is required for ${application}/${environment} but unavailable (${detail}).`);
  }
  const testDir = path.resolve('projects', application, 'tests');
  if (!fs.existsSync(testDir)) throw new Error(`Project tests not found: ${testDir}`);

  const requireAuth = normalized.requireAuth ?? laneRequiresBrowserAuth(policy.lane);
  let storageState: string | undefined;
  const auth = config.auth ?? { strategy: 'none' as const };
  if (auth.strategy === 'storageState') {
    const authPaths = resolveAuthStatePaths(auth);
    storageState = authPaths.storageStatePath;
    if (!storageState && requireAuth && auth.required !== false) {
      throw new Error(`Project '${application}' requires storageState but no path is configured.`);
    }
    if (requireAuth && auth.required !== false && !hasPersistedAuthState(authPaths)) {
      throw new Error(
        `Authentication state is required for lane '${policy.lane ?? 'unspecified'}' but missing or empty: ${storageState ?? '(unconfigured)'}\n` +
        `Run: APP=${application} ENV=${environment} APPLICATION_EXPLORATION_ENABLED=true npm run app:auth`,
      );
    }
  }

  return {
    application,
    environment,
    testDir,
    uiBaseUrl: config.application.uiBaseUrl,
    apiBaseUrl: config.application.apiBaseUrl,
    storageState: requireAuth ? storageState : undefined,
    lane: policy.lane,
    profile: policy.profile,
    database,
  };
}

if (process.argv[1] && /project-check\.(?:ts|js)$/.test(process.argv[1])) {
  try { console.log(JSON.stringify(projectPreflight(), null, 2)); }
  catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
