import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { BrowserContextOptions } from '@playwright/test';
import type { ProjectAuthConfig } from './config/config.types';
import type { SessionStorageSnapshot } from './auth.state';

export type BrowserStorageState = Exclude<BrowserContextOptions['storageState'], string | undefined>;
export type AuthRefreshReason = 'pre-run' | 'runtime' | 'manual';

export interface AuthProviderContext {
  application: string;
  environment: string;
  baseUrl: string;
  apiBaseUrl: string;
  auth: ProjectAuthConfig;
  reason: AuthRefreshReason;
  storageStatePath: string;
  sessionStoragePath: string;
}

export interface AuthRefreshResult {
  storageState: BrowserStorageState;
  sessionStorage?: SessionStorageSnapshot;
  /** ISO timestamp or epoch milliseconds. Used only for proactive refresh planning. */
  expiresAt?: string | number;
  /** Optional safe provider label for logs/metadata. Never include credentials or tokens. */
  providerId?: string;
}

export interface ProjectAuthProvider {
  id?: string;
  refresh(context: AuthProviderContext): Promise<AuthRefreshResult>;
}

type ProviderModuleShape = {
  default?: ProjectAuthProvider | ((context: AuthProviderContext) => Promise<AuthRefreshResult>);
  authProvider?: ProjectAuthProvider;
  refreshAuth?: (context: AuthProviderContext) => Promise<AuthRefreshResult>;
};

/** Loads a project-owned auth provider while keeping login details outside reusable framework code. */
export async function loadProjectAuthProvider(
  application: string,
  auth: ProjectAuthConfig,
  root = process.cwd(),
): Promise<ProjectAuthProvider> {
  const configured = auth.lifecycle?.providerModule?.trim();
  if (!configured) {
    throw new Error(
      `AUTH_REFRESH_PROVIDER_MISSING: autoRefresh is enabled for '${application}' but auth.lifecycle.providerModule is not configured.`,
    );
  }
  const modulePath = resolveProviderModulePath(root, application, configured);
  if (!fs.existsSync(modulePath)) {
    throw new Error(`AUTH_REFRESH_PROVIDER_MISSING: provider module not found: ${modulePath}`);
  }
  const loaded = await import(pathToFileURL(modulePath).href) as ProviderModuleShape;
  const candidate = loaded.authProvider ?? loaded.default ?? loaded.refreshAuth;
  if (typeof candidate === 'function') {
    return { id: path.basename(modulePath), refresh: candidate };
  }
  if (candidate && typeof candidate.refresh === 'function') return candidate;
  throw new Error(
    `AUTH_REFRESH_PROVIDER_INVALID: ${modulePath} must export default/authProvider with refresh(), or refreshAuth(context).`,
  );
}

/** Resolves a project auth-provider module without leaking project-specific login logic into the reusable core. */
export function resolveProviderModulePath(root: string, application: string, configured: string): string {
  if (path.isAbsolute(configured)) return configured;
  const repositoryRelative = path.resolve(root, configured);
  if (configured.startsWith('projects/') || configured.startsWith('src/') || configured.startsWith('templates/')) {
    return repositoryRelative;
  }
  return path.resolve(root, 'projects', application, configured);
}
