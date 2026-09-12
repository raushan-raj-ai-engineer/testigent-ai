import type { ExecutionSettings, ExecutionProfileName } from '../execution/execution.types';
/** Author: Raushan Raj */

export type SupportedBrowser = 'chromium' | 'firefox' | 'webkit';
export type TracePolicy = 'off' | 'on' | 'retain-on-failure' | 'on-first-retry';
export type ScreenshotPolicy = 'off' | 'on' | 'only-on-failure';
export type VideoPolicy = 'off' | 'on' | 'retain-on-failure' | 'on-first-retry';
export type DatabaseType = 'none' | 'postgres' | 'mysql' | 'mssql';

export interface PlaywrightRuntimeSettings {
  browsers: SupportedBrowser[];
  trace: TracePolicy;
  screenshot: ScreenshotPolicy;
  video: VideoPolicy;
  visualMaxDiffPixelRatio: number;
  ignoreHTTPSErrors: boolean;
  wsConnectTimeoutMs: number;
}
export interface ApplicationConfig {
  name: string;
  uiBaseUrl: string;
  apiBaseUrl: string;
}

export interface DatabaseCapabilityConfig {
  type?: DatabaseType;
  required?: boolean;
}

export interface ProjectCapabilitiesConfig {
  database?: DatabaseCapabilityConfig;
}

export interface ResolvedDatabaseCapability {
  type: DatabaseType;
  required: boolean;
  enabled: boolean;
  missingConfiguration: string[];
}

export interface ResolvedProjectCapabilities {
  database: ResolvedDatabaseCapability;
}

export interface AuthControlVerificationConfig {
  role: 'button' | 'link' | 'menuitem' | 'tab' | 'textbox' | 'heading';
  name?: string;
  exact?: boolean;
  namePattern?: string;
  namePatternFlags?: string;
}

export interface AuthStateKeyVerificationConfig {
  name: string;
  storage?: 'local' | 'session' | 'either';
}

export interface ProjectAuthVerificationConfig {
  authenticatedUrlPattern?: string;
  unauthenticatedUrlPattern?: string;
  urlPatternFlags?: string;
  authenticatedControl?: AuthControlVerificationConfig;
  unauthenticatedControl?: AuthControlVerificationConfig;
  stateKey?: AuthStateKeyVerificationConfig;
  settleMs?: number;
  timeoutMs?: number;
}

export interface ProjectAuthConfig {
  strategy: 'none' | 'storageState';
  storageStatePath?: string;
  required?: boolean;
  verification?: ProjectAuthVerificationConfig;
}

export interface ProjectEnvironmentConfig {
  environment: string;
  application: ApplicationConfig;
  auth?: ProjectAuthConfig;
  capabilities?: ProjectCapabilitiesConfig;
  execution?: ExecutionSettings;
  profiles?: Partial<Record<ExecutionProfileName, ExecutionSettings>>;
  playwright?: Partial<PlaywrightRuntimeSettings>;
}

/** Compatibility shape used by generic framework services. */
export interface EnvironmentConfig {
  environment: string;
  applications: Record<string, ApplicationConfig>;
}
