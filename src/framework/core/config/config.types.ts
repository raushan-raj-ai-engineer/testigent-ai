import type { ExecutionSettings, ExecutionProfileName } from '../execution/execution.types';
/** Author: Raushan Raj */
export interface ApplicationConfig {
  name: string;
  uiBaseUrl: string;
  apiBaseUrl: string;
}

export interface ProjectAuthConfig {
  strategy: 'none' | 'storageState';
  storageStatePath?: string;
  required?: boolean;
}

export interface ProjectEnvironmentConfig {
  environment: string;
  application: ApplicationConfig;
  auth?: ProjectAuthConfig;
  execution?: ExecutionSettings;
  profiles?: Partial<Record<ExecutionProfileName, ExecutionSettings>>;
}

/** Compatibility shape used by generic framework services. */
export interface EnvironmentConfig {
  environment: string;
  applications: Record<string, ApplicationConfig>;
}
