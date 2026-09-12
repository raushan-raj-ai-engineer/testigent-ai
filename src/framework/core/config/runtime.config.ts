import fs from 'node:fs';
import path from 'node:path';
import type { ExecutionConfigLayer, ResolvedExecutionPolicy } from '../execution/execution.types';
import { resolveExecutionPolicy } from '../execution/execution.policy';
import { ApplicationRegistry } from './application.registry';
import type {
  ApplicationConfig,
  DatabaseCapabilityConfig,
  DatabaseType,
  PlaywrightRuntimeSettings,
  ProjectAuthConfig,
  ProjectEnvironmentConfig,
  ProjectCapabilitiesConfig,
  ResolvedProjectCapabilities,
  ScreenshotPolicy,
  SupportedBrowser,
  TracePolicy,
  VideoPolicy,
} from './config.types';
import { WorkspaceContext } from './workspace.context';

export type { PlaywrightRuntimeSettings, SupportedBrowser } from './config.types';

interface RuntimeLayer extends ExecutionConfigLayer {
  playwright?: Partial<PlaywrightRuntimeSettings>;
  capabilities?: ProjectCapabilitiesConfig;
}

export interface ResolvedRuntimeConfig {
  applicationName: string;
  environment: string;
  application: ApplicationConfig;
  auth: ProjectAuthConfig;
  project: ProjectEnvironmentConfig;
  execution: ResolvedExecutionPolicy;
  playwright: PlaywrightRuntimeSettings;
  capabilities: ResolvedProjectCapabilities;
  projectRoot: string;
  reportRoot: string;
  resultRoot: string;
}

/**
 * One read-only runtime view for Playwright, fixtures, reporting and framework services.
 * Project/environment selection is delegated to WorkspaceContext so every subsystem shares
 * identical resolution rules and reusable code never silently selects a demo application.
 */
export class RuntimeConfig {
  static resolve(root = process.cwd(), env: NodeJS.ProcessEnv = process.env): ResolvedRuntimeConfig {
    const target = WorkspaceContext.resolve({ root, env });
    const project = ApplicationRegistry.projectConfig(target.application, target.environment, root);
    const execution = resolveExecutionPolicy({
      root,
      application: target.application,
      environment: target.environment,
      env,
    });
    const playwright = this.resolvePlaywrightSettings(root, target.application, target.environment, env);
    const capabilities = this.resolveCapabilities(root, target.application, target.environment, env);

    return {
      applicationName: target.application,
      environment: target.environment,
      application: project.application,
      auth: project.auth ?? { strategy: 'none' },
      project,
      execution,
      playwright,
      capabilities,
      projectRoot: path.resolve(root, 'projects', target.application),
      reportRoot: path.resolve(root, 'reports', target.application),
      resultRoot: path.resolve(root, 'test-results', target.application),
    };
  }


  static resolveCapabilities(
    root: string,
    application: string,
    environment: string,
    env: NodeJS.ProcessEnv = process.env,
  ): ResolvedProjectCapabilities {
    const organization = readLayer(path.resolve(root, 'config', 'organization.json'));
    const project = readLayer(path.resolve(root, 'projects', application, 'project.json'));
    const environmentLayer = readLayer(path.resolve(root, 'projects', application, 'config', `${environment}.json`));

    const database = mergeDatabaseCapability(
      organization.capabilities?.database,
      project.capabilities?.database,
      environmentLayer.capabilities?.database,
    );
    const configuredType = (database.type || 'none').toLowerCase();
    if (!['none', 'postgres', 'mysql', 'mssql'].includes(configuredType)) {
      throw new Error(`Unsupported database capability type '${configuredType}' for ${application}/${environment}.`);
    }
    const type = configuredType as DatabaseType;
    const missingConfiguration = type === 'none'
      ? []
      : ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'].filter(name => !env[name]?.trim());

    return {
      database: {
        type,
        required: database.required ?? false,
        enabled: type !== 'none' && missingConfiguration.length === 0,
        missingConfiguration,
      },
    };
  }

  static resolvePlaywrightSettings(
    root: string,
    application: string,
    environment: string,
    env: NodeJS.ProcessEnv = process.env,
  ): PlaywrightRuntimeSettings {
    const organization = readLayer(path.resolve(root, 'config', 'organization.json'));
    const project = readLayer(path.resolve(root, 'projects', application, 'project.json'));
    const environmentLayer = readLayer(path.resolve(root, 'projects', application, 'config', `${environment}.json`));

    const merged: Partial<PlaywrightRuntimeSettings> = {
      ...(organization.playwright ?? {}),
      ...(project.playwright ?? {}),
      ...(environmentLayer.playwright ?? {}),
    };

    if (env.PW_BROWSERS?.trim()) merged.browsers = env.PW_BROWSERS.split(',').map(item => item.trim()).filter(Boolean) as SupportedBrowser[];
    if (env.PW_TRACE?.trim()) merged.trace = env.PW_TRACE.trim() as TracePolicy;
    if (env.PW_SCREENSHOT?.trim()) merged.screenshot = env.PW_SCREENSHOT.trim() as ScreenshotPolicy;
    if (env.PW_VIDEO?.trim()) merged.video = env.PW_VIDEO.trim() as VideoPolicy;
    if (env.VISUAL_MAX_DIFF_RATIO?.trim()) merged.visualMaxDiffPixelRatio = Number(env.VISUAL_MAX_DIFF_RATIO);
    if (env.PW_IGNORE_HTTPS_ERRORS?.trim()) merged.ignoreHTTPSErrors = parseBoolean('PW_IGNORE_HTTPS_ERRORS', env.PW_IGNORE_HTTPS_ERRORS);
    if (env.PW_WS_TIMEOUT_MS?.trim()) merged.wsConnectTimeoutMs = Number(env.PW_WS_TIMEOUT_MS);

    return validatePlaywrightSettings(merged, application, environment);
  }
}

function readLayer(file: string): RuntimeLayer {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8')) as RuntimeLayer;
}

function validatePlaywrightSettings(
  value: Partial<PlaywrightRuntimeSettings>,
  application: string,
  environment: string,
): PlaywrightRuntimeSettings {
  const required: (keyof PlaywrightRuntimeSettings)[] = [
    'browsers', 'trace', 'screenshot', 'video', 'visualMaxDiffPixelRatio', 'ignoreHTTPSErrors', 'wsConnectTimeoutMs',
  ];
  const missing = required.filter(key => value[key] === undefined);
  if (missing.length) {
    throw new Error(
      `Playwright runtime policy is incomplete for ${application}/${environment}: ${missing.join(', ')}. ` +
      `Define organization defaults in config/organization.json and override only when needed.`,
    );
  }

  const browsers = value.browsers!;
  if (!Array.isArray(browsers) || browsers.length === 0 || browsers.some(browser => !['chromium', 'firefox', 'webkit'].includes(browser))) {
    throw new Error(`Invalid playwright.browsers for ${application}/${environment}. Use chromium, firefox and/or webkit.`);
  }
  if (!['off', 'on', 'retain-on-failure', 'on-first-retry'].includes(value.trace!)) throw new Error(`Invalid playwright.trace '${value.trace}'.`);
  if (!['off', 'on', 'only-on-failure'].includes(value.screenshot!)) throw new Error(`Invalid playwright.screenshot '${value.screenshot}'.`);
  if (!['off', 'on', 'retain-on-failure', 'on-first-retry'].includes(value.video!)) throw new Error(`Invalid playwright.video '${value.video}'.`);
  if (!Number.isFinite(value.visualMaxDiffPixelRatio) || value.visualMaxDiffPixelRatio! < 0 || value.visualMaxDiffPixelRatio! > 1) {
    throw new Error(`playwright.visualMaxDiffPixelRatio must be between 0 and 1.`);
  }
  if (!Number.isInteger(value.wsConnectTimeoutMs) || value.wsConnectTimeoutMs! <= 0) throw new Error(`playwright.wsConnectTimeoutMs must be a positive integer.`);

  return {
    browsers: [...new Set(browsers)],
    trace: value.trace!,
    screenshot: value.screenshot!,
    video: value.video!,
    visualMaxDiffPixelRatio: value.visualMaxDiffPixelRatio!,
    ignoreHTTPSErrors: value.ignoreHTTPSErrors!,
    wsConnectTimeoutMs: value.wsConnectTimeoutMs!,
  };
}

function parseBoolean(name: string, raw: string): boolean {
  if (/^(1|true|yes|on)$/i.test(raw.trim())) return true;
  if (/^(0|false|no|off)$/i.test(raw.trim())) return false;
  throw new Error(`${name} must be true/false, received '${raw}'.`);
}

function mergeDatabaseCapability(...layers: Array<DatabaseCapabilityConfig | undefined>): DatabaseCapabilityConfig {
  return Object.assign({}, ...layers.filter(Boolean));
}
