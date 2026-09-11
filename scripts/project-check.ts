import fs from 'node:fs';
import path from 'node:path';
import { ApplicationRegistry } from '../src/framework/core/config/application.registry';
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
  const application = process.env.APP?.trim();
  if (!application) throw new Error(`APP is required. Available projects: ${ApplicationRegistry.listProjects().join(', ') || '(none)'}`);
  const environment = process.env.ENV?.trim() || 'qa';
  const policy = resolveExecutionPolicy({ application, environment, lane: normalized.lane });
  const config = ApplicationRegistry.projectConfig(application, environment);
  const testDir = path.resolve('projects', application, 'tests');
  if (!fs.existsSync(testDir)) throw new Error(`Project tests not found: ${testDir}`);

  const requireAuth = normalized.requireAuth ?? laneRequiresBrowserAuth(policy.lane);
  let storageState: string | undefined;
  const auth = config.auth ?? { strategy: 'none' as const };
  if (auth.strategy === 'storageState') {
    const configured = process.env.PW_STORAGE_STATE?.trim() || auth.storageStatePath;
    if (configured) {
      storageState = path.isAbsolute(configured) ? configured : path.resolve(configured);
      if (requireAuth && auth.required !== false && !fs.existsSync(storageState)) {
        throw new Error(
          `Authentication state is required for lane '${policy.lane ?? 'unspecified'}' but missing: ${storageState}\n` +
          `Run: APP=${application} ENV=${environment} APPLICATION_EXPLORATION_ENABLED=true npm run app:auth`,
        );
      }
    } else if (requireAuth && auth.required !== false) {
      throw new Error(`Project '${application}' requires storageState but no path is configured.`);
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
  };
}

if (process.argv[1] && /project-check\.(?:ts|js)$/.test(process.argv[1])) {
  try { console.log(JSON.stringify(projectPreflight(), null, 2)); }
  catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
