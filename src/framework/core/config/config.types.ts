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

export type AuthRuntimeRecoveryMode = 'off' | 'navigation';

export interface ProjectAuthLifecycleConfig {
  /** Enables project-owned non-interactive refresh through providerModule. */
  autoRefresh?: boolean;
  /** Project-relative (preferred) or repository-relative module exporting an auth provider. */
  providerModule?: string;
  /** Verify persisted auth in a fresh browser before UI/E2E execution. */
  verifyBeforeRun?: boolean;
  /** Refresh this far ahead of a known token expiry to avoid mid-action expiry. */
  refreshSkewMs?: number;
  /** Number of provider attempts for one refresh operation. */
  maxRefreshAttempts?: number;
  /** Safe in-test recovery boundary. Navigation can be replayed; mutating actions are never blindly replayed. */
  runtimeRecovery?: AuthRuntimeRecoveryMode;
  /** Maximum auth refreshes initiated by one browser context after execution has started. */
  maxRuntimeRefreshes?: number;
  /** Cross-worker/process lock wait budget. */
  lockTimeoutMs?: number;
  /** Lock age after which a crashed refresh owner may be reclaimed. */
  lockStaleMs?: number;
}

export interface ProjectAuthConfig {
  strategy: 'none' | 'storageState';
  storageStatePath?: string;
  required?: boolean;
  verification?: ProjectAuthVerificationConfig;
  lifecycle?: ProjectAuthLifecycleConfig;
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
