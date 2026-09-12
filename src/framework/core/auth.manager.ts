import fs from 'node:fs';
import path from 'node:path';
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import type { ResolvedRuntimeConfig } from './config/runtime.config';
import type { ProjectAuthLifecycleConfig } from './config/config.types';
import { acquireFileLock } from './auth.lock';
import { loadProjectAuthProvider, type AuthRefreshReason, type AuthRefreshResult } from './auth.provider';
import {
  applyLocalStorageStateToPage,
  applySessionStorageSnapshotToPage,
  hasPersistedAuthState,
  inferConfiguredAuthExpiry,
  installSessionStorageSnapshot,
  normalizeAuthExpiry,
  readAuthStateMetadata,
  readSessionStorageSnapshot,
  resolveAuthStatePaths,
  storageStateHasData,
  writeAuthStateMetadata,
  writeBrowserStorageState,
  writeSessionStorageSnapshot,
  type AuthStateMetadata,
  type ResolvedAuthStatePaths,
} from './auth.state';
import { verifyAuthenticatedPage, type AuthVerificationResult } from './auth.verifier';

interface ResolvedLifecycle {
  autoRefresh: boolean;
  providerModule?: string;
  verifyBeforeRun: boolean;
  refreshSkewMs: number;
  maxRefreshAttempts: number;
  runtimeRecovery: 'off' | 'navigation';
  maxRuntimeRefreshes: number;
  lockTimeoutMs: number;
  lockStaleMs: number;
}

export interface AuthPreparationResult {
  required: boolean;
  ready: boolean;
  refreshed: boolean;
  verified: boolean;
  reason?: string;
  expiresAt?: string;
}

export interface AuthPrepareOptions {
  required?: boolean;
  allowRefresh?: boolean;
}

/**
 * Reusable auth lifecycle coordinator. It owns freshness/locking/persistence; project modules own login/refresh mechanics.
 */
export class AuthManager {
  private readonly paths: ResolvedAuthStatePaths;
  private readonly lifecycle: ResolvedLifecycle;
  private runtimeRefreshes = 0;

  constructor(private readonly runtime: ResolvedRuntimeConfig, private readonly root = process.cwd()) {
    this.paths = resolveAuthStatePaths(runtime.auth, root);
    this.lifecycle = resolveLifecycle(runtime.auth.lifecycle);
  }

  describe(): Record<string, unknown> {
    const metadata = readAuthStateMetadata(this.paths.metadataPath);
    const inferredExpiry = inferConfiguredAuthExpiry(this.paths, this.runtime.auth.verification);
    return {
      strategy: this.runtime.auth.strategy,
      required: this.runtime.auth.required ?? false,
      ready: this.runtime.auth.strategy !== 'storageState' || hasPersistedAuthState(this.paths),
      autoRefresh: this.lifecycle.autoRefresh,
      providerModule: this.lifecycle.providerModule,
      verifyBeforeRun: this.lifecycle.verifyBeforeRun,
      runtimeRecovery: this.lifecycle.runtimeRecovery,
      expiresAt: metadata?.expiresAt ?? inferredExpiry?.toISOString(),
      lastVerifiedAt: metadata?.verifiedAt,
    };
  }

  async prepareForRun(options: AuthPrepareOptions = {}): Promise<AuthPreparationResult> {
    const required = options.required ?? this.runtime.auth.required !== false;
    const allowRefresh = options.allowRefresh ?? true;
    if (this.runtime.auth.strategy !== 'storageState' || !required) {
      return { required, ready: true, refreshed: false, verified: false };
    }
    this.requirePaths();

    let refreshed = false;
    if (!hasPersistedAuthState(this.paths)) {
      if (!allowRefresh || !this.lifecycle.autoRefresh) {
        return {
          required,
          ready: false,
          refreshed: false,
          verified: false,
          reason: `Authentication state is missing: ${this.paths.storageStatePath}`,
        };
      }
      const result = await this.refresh('pre-run');
      refreshed = result.refreshed;
    } else if (this.shouldRefreshProactively() && allowRefresh && this.lifecycle.autoRefresh) {
      const result = await this.refresh('pre-run');
      refreshed = result.refreshed;
    }

    if (!hasPersistedAuthState(this.paths)) {
      return { required, ready: false, refreshed, verified: false, reason: 'Authentication state is still unavailable after refresh.' };
    }

    if (!this.lifecycle.verifyBeforeRun) {
      return { required, ready: true, refreshed, verified: false, expiresAt: this.currentExpiry() };
    }

    const verification = await this.verifyPersistedState();
    if (verification.ok) {
      this.markVerified();
      return { required, ready: true, refreshed, verified: true, expiresAt: this.currentExpiry() };
    }

    if (allowRefresh && this.lifecycle.autoRefresh) {
      const result = await this.refresh('pre-run');
      refreshed = refreshed || result.refreshed;
      // refresh() validates the candidate in a fresh browser before promotion.
      return { required, ready: true, refreshed, verified: true, expiresAt: this.currentExpiry() };
    }

    return {
      required,
      ready: false,
      refreshed,
      verified: true,
      reason: verification.reason ?? 'Authentication verification failed.',
      expiresAt: this.currentExpiry(),
    };
  }

  /**
   * Cheap pre-action guard. It refreshes only when a known expiry is inside the configured safety window,
   * and it runs before the business action so no mutating operation is ever replayed.
   */
  async ensureFreshBeforeAction(page: Page): Promise<void> {
    if (this.runtime.auth.strategy !== 'storageState' || this.runtime.auth.required === false) return;
    if (!this.lifecycle.autoRefresh || !this.shouldRefreshProactively()) return;
    if (this.runtimeRefreshes >= this.lifecycle.maxRuntimeRefreshes) {
      throw new Error(
        `AUTH_REFRESH_LIMIT: authentication is nearing expiry before a business action but the runtime refresh limit ` +
        `(${this.lifecycle.maxRuntimeRefreshes}) was reached.`,
      );
    }
    this.runtimeRefreshes += 1;
    await this.refresh('runtime');
    await this.applyPersistedState(page.context(), page);
  }

  /**
   * Safe mid-run recovery: only a navigation is replayed after refresh. Mutating clicks/fills are never blindly retried.
   */
  async ensureAuthenticatedNavigation(page: Page, targetUrl: string): Promise<void> {
    if (this.runtime.auth.strategy !== 'storageState' || this.runtime.auth.required === false) return;

    // Refresh slightly before known expiry at a safe navigation boundary. This avoids a token expiring
    // during the next business action without ever replaying a mutating click/fill/submit operation.
    if (
      this.lifecycle.autoRefresh &&
      this.lifecycle.runtimeRecovery === 'navigation' &&
      this.shouldRefreshProactively()
    ) {
      await this.refreshAndReplayNavigation(page, targetUrl, 'proactive expiry window');
    }

    const verification = await verifyAuthenticatedPage(page, this.runtime.auth.verification);
    if (verification.ok) return;

    if (!this.lifecycle.autoRefresh || this.lifecycle.runtimeRecovery !== 'navigation') {
      throw invalidSessionError(verification);
    }
    await this.refreshAndReplayNavigation(page, targetUrl, verification.reason ?? 'authentication verification failed');

    const after = await verifyAuthenticatedPage(page, this.runtime.auth.verification);
    if (!after.ok) {
      throw new Error(
        `AUTH_REFRESH_FAILED: refreshed state could not restore the authenticated page. ${after.reason ?? 'verification failed'}`,
      );
    }
  }

  private async refreshAndReplayNavigation(page: Page, targetUrl: string, trigger: string): Promise<void> {
    if (this.runtimeRefreshes >= this.lifecycle.maxRuntimeRefreshes) {
      throw new Error(
        `AUTH_REFRESH_LIMIT: authentication needs refresh (${trigger}) but the runtime refresh limit ` +
        `(${this.lifecycle.maxRuntimeRefreshes}) was reached.`,
      );
    }
    this.runtimeRefreshes += 1;
    await this.refresh('runtime');
    await this.applyPersistedState(page.context(), page);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  }

  async refresh(reason: AuthRefreshReason): Promise<{ refreshed: boolean; reusedConcurrentRefresh: boolean }> {
    this.requirePaths();
    if (!this.lifecycle.autoRefresh) throw new Error('AUTH_AUTO_REFRESH_DISABLED: auth lifecycle autoRefresh is false.');
    const providerModule = this.lifecycle.providerModule;
    if (!providerModule) throw new Error('AUTH_REFRESH_PROVIDER_MISSING: auth.lifecycle.providerModule is required for auto refresh.');

    const paths = this.paths as Required<Pick<ResolvedAuthStatePaths, 'storageStatePath' | 'sessionStoragePath' | 'metadataPath' | 'lockPath'>>;
    const requestedAt = Date.now();
    const before = readAuthStateMetadata(paths.metadataPath)?.refreshedAt;
    const lock = await acquireFileLock(paths.lockPath, {
      timeoutMs: this.lifecycle.lockTimeoutMs,
      staleMs: this.lifecycle.lockStaleMs,
    });
    try {
      const afterLock = readAuthStateMetadata(paths.metadataPath);
      if (
        afterLock?.refreshedAt &&
        afterLock.refreshedAt !== before &&
        new Date(afterLock.refreshedAt).getTime() >= requestedAt - 1_000 &&
        hasPersistedAuthState(paths)
      ) {
        console.log(`[auth] reused concurrently refreshed state for ${this.runtime.applicationName}/${this.runtime.environment}`);
        return { refreshed: false, reusedConcurrentRefresh: true };
      }

      const provider = await loadProjectAuthProvider(this.runtime.applicationName, this.runtime.auth, this.root);
      let lastError: unknown;
      for (let attempt = 1; attempt <= this.lifecycle.maxRefreshAttempts; attempt += 1) {
        try {
          const result = await provider.refresh({
            application: this.runtime.applicationName,
            environment: this.runtime.environment,
            baseUrl: this.runtime.application.uiBaseUrl,
            apiBaseUrl: this.runtime.application.apiBaseUrl,
            auth: this.runtime.auth,
            reason,
            storageStatePath: paths.storageStatePath,
            sessionStoragePath: paths.sessionStoragePath,
          });
          await this.validateAndPromote(result, provider.id ?? result.providerId ?? path.basename(providerModule));
          console.log(
            `[auth] ${reason} refresh verified for ${this.runtime.applicationName}/${this.runtime.environment}` +
            (this.currentExpiry() ? ` (expires ${this.currentExpiry()})` : ''),
          );
          return { refreshed: true, reusedConcurrentRefresh: false };
        } catch (error) {
          lastError = error;
          if (attempt < this.lifecycle.maxRefreshAttempts) await delay(Math.min(1_000, 250 * attempt));
        }
      }
      throw new Error(
        `AUTH_REFRESH_FAILED: ${lastError instanceof Error ? lastError.message : String(lastError ?? 'provider refresh failed')}`,
      );
    } finally {
      lock.release();
    }
  }

  private async validateAndPromote(result: AuthRefreshResult, providerId: string): Promise<void> {
    const paths = this.requirePaths();
    const suffix = `.candidate-${process.pid}-${Date.now()}`;
    const candidateStorage = `${paths.storageStatePath}${suffix}`;
    const candidateSession = `${paths.sessionStoragePath}${suffix}`;
    try {
      writeBrowserStorageState(candidateStorage, result.storageState);
      if (result.sessionStorage) writeSessionStorageSnapshot(candidateSession, result.sessionStorage);
      if (!storageStateHasData(candidateStorage) && !result.sessionStorage?.origins.some(origin => Object.keys(origin.entries).length > 0)) {
        throw new Error('Auth provider returned an empty browser/session state.');
      }
      const verification = await this.verifyStateFiles(candidateStorage, result.sessionStorage ? candidateSession : undefined);
      if (!verification.ok) {
        throw new Error(`Provider result failed fresh-context verification: ${verification.reason ?? 'unknown reason'}`);
      }

      promoteFile(candidateStorage, paths.storageStatePath);
      if (result.sessionStorage) promoteFile(candidateSession, paths.sessionStoragePath);
      else fs.rmSync(paths.sessionStoragePath, { force: true });

      const inferredExpiry = inferConfiguredAuthExpiry(paths, this.runtime.auth.verification)?.toISOString();
      const expiresAt = normalizeAuthExpiry(result.expiresAt) ?? inferredExpiry;
      const now = new Date().toISOString();
      writeAuthStateMetadata(paths.metadataPath, {
        version: 1,
        application: this.runtime.applicationName,
        environment: this.runtime.environment,
        refreshedAt: now,
        verifiedAt: now,
        expiresAt,
        providerId,
      });
    } finally {
      fs.rmSync(candidateStorage, { force: true });
      fs.rmSync(candidateSession, { force: true });
    }
  }

  private async verifyPersistedState(): Promise<AuthVerificationResult> {
    const paths = this.requirePaths();
    return this.verifyStateFiles(paths.storageStatePath, fs.existsSync(paths.sessionStoragePath) ? paths.sessionStoragePath : undefined);
  }

  private async verifyStateFiles(storageStatePath: string, sessionStoragePath?: string): Promise<AuthVerificationResult> {
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ storageState: storageStatePath });
      try {
        if (sessionStoragePath) await installSessionStorageSnapshot(context, readSessionStorageSnapshot(sessionStoragePath));
        const page = await context.newPage();
        await page.goto(this.runtime.application.uiBaseUrl, { waitUntil: 'domcontentloaded' });
        return await verifyAuthenticatedPage(page, this.runtime.auth.verification);
      } finally {
        await context.close();
      }
    } catch (error) {
      return { ok: false, reason: `Fresh-context verification error: ${error instanceof Error ? error.message : String(error)}` };
    } finally {
      await browser.close();
    }
  }

  private async applyPersistedState(context: BrowserContext, page: Page): Promise<void> {
    const paths = this.requirePaths();
    await context.setStorageState(paths.storageStatePath);
    await applyLocalStorageStateToPage(page, paths.storageStatePath);
    const session = readSessionStorageSnapshot(paths.sessionStoragePath);
    await installSessionStorageSnapshot(context, session);
    await applySessionStorageSnapshotToPage(page, session);
  }

  private shouldRefreshProactively(): boolean {
    const expiry = this.currentExpiryDate();
    return Boolean(expiry && Date.now() + this.lifecycle.refreshSkewMs >= expiry.getTime());
  }

  private currentExpiry(): string | undefined {
    return this.currentExpiryDate()?.toISOString();
  }

  private currentExpiryDate(): Date | undefined {
    const metadata = readAuthStateMetadata(this.paths.metadataPath);
    if (metadata?.expiresAt) {
      const parsed = new Date(metadata.expiresAt);
      if (Number.isFinite(parsed.getTime())) return parsed;
    }
    return inferConfiguredAuthExpiry(this.paths, this.runtime.auth.verification);
  }

  private markVerified(): void {
    const paths = this.requirePaths();
    const existing = readAuthStateMetadata(paths.metadataPath);
    const now = new Date().toISOString();
    const fallbackRefreshedAt = existing?.refreshedAt ?? fileTimestamp(paths.storageStatePath) ?? now;
    const metadata: AuthStateMetadata = {
      version: 1,
      application: this.runtime.applicationName,
      environment: this.runtime.environment,
      refreshedAt: fallbackRefreshedAt,
      verifiedAt: now,
      expiresAt: existing?.expiresAt ?? inferConfiguredAuthExpiry(paths, this.runtime.auth.verification)?.toISOString(),
      providerId: existing?.providerId,
    };
    writeAuthStateMetadata(paths.metadataPath, metadata);
  }

  private requirePaths(): Required<Pick<ResolvedAuthStatePaths, 'storageStatePath' | 'sessionStoragePath' | 'metadataPath' | 'lockPath'>> {
    const { storageStatePath, sessionStoragePath, metadataPath, lockPath } = this.paths;
    if (!storageStatePath || !sessionStoragePath || !metadataPath || !lockPath) {
      throw new Error(`Project '${this.runtime.applicationName}' requires a configured auth.storageStatePath.`);
    }
    return { storageStatePath, sessionStoragePath, metadataPath, lockPath };
  }
}

function resolveLifecycle(config: ProjectAuthLifecycleConfig | undefined): ResolvedLifecycle {
  return {
    autoRefresh: config?.autoRefresh ?? false,
    providerModule: config?.providerModule?.trim() || undefined,
    verifyBeforeRun: config?.verifyBeforeRun ?? true,
    refreshSkewMs: positiveInt(config?.refreshSkewMs, 120_000),
    maxRefreshAttempts: positiveInt(config?.maxRefreshAttempts, 2),
    runtimeRecovery: config?.runtimeRecovery ?? 'navigation',
    maxRuntimeRefreshes: positiveInt(config?.maxRuntimeRefreshes, 1),
    lockTimeoutMs: positiveInt(config?.lockTimeoutMs, 30_000),
    lockStaleMs: positiveInt(config?.lockStaleMs, 120_000),
  };
}

function positiveInt(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && value! > 0 ? value! : fallback;
}

function invalidSessionError(result: AuthVerificationResult): Error {
  return new Error(
    `AUTH_SESSION_INVALID: ${result.reason ?? 'Authentication verification failed.'} ` +
    `Auto refresh is not available for this project/run; refresh state with 'npm run qa:auth'.`,
  );
}

function fileTimestamp(file: string): string | undefined {
  try { return new Date(fs.statSync(file).mtimeMs).toISOString(); }
  catch { return undefined; }
}

function promoteFile(source: string, destination: string): void {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  try {
    fs.renameSync(source, destination);
  } catch {
    fs.copyFileSync(source, destination);
    fs.rmSync(source, { force: true });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
