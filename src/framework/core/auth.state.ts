import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext, BrowserContextOptions, Page } from '@playwright/test';
import type { ProjectAuthConfig, ProjectAuthVerificationConfig } from './config/config.types';

export interface SessionStorageSnapshot {
  version: 1;
  origins: Array<{ origin: string; entries: Record<string, string> }>;
}

export interface AuthStateMetadata {
  version: 1;
  application: string;
  environment: string;
  refreshedAt: string;
  verifiedAt: string;
  expiresAt?: string;
  providerId?: string;
}

export interface ResolvedAuthStatePaths {
  storageStatePath?: string;
  sessionStoragePath?: string;
  metadataPath?: string;
  lockPath?: string;
}

export type BrowserStorageState = Exclude<BrowserContextOptions['storageState'], string | undefined>;

/** Resolves storage, session, metadata and refresh-lock paths for a storage-state authentication strategy. */
export function resolveAuthStatePaths(
  auth: ProjectAuthConfig,
  root = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): ResolvedAuthStatePaths {
  if (auth.strategy !== 'storageState') return {};
  const configured = env.PW_STORAGE_STATE?.trim() || auth.storageStatePath;
  if (!configured) return {};
  const storageStatePath = path.isAbsolute(configured) ? configured : path.resolve(root, configured);
  return {
    storageStatePath,
    sessionStoragePath: `${storageStatePath}.session.json`,
    metadataPath: `${storageStatePath}.meta.json`,
    lockPath: `${storageStatePath}.refresh.lock`,
  };
}

/** Returns whether persisted browser or session storage contains usable authentication material. */
export function hasPersistedAuthState(paths: ResolvedAuthStatePaths): boolean {
  const hasStorage = Boolean(paths.storageStatePath && storageStateHasData(paths.storageStatePath));
  const hasSession = Boolean(paths.sessionStoragePath && sessionStorageHasData(paths.sessionStoragePath));
  return hasStorage || hasSession;
}

/** Safely checks whether a Playwright storage-state file contains cookies or localStorage entries. */
export function storageStateHasData(file: string): boolean {
  if (!fs.existsSync(file)) return false;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      cookies?: unknown[];
      origins?: Array<{ localStorage?: unknown[] }>;
    };
    return Boolean(
      parsed.cookies?.length ||
      parsed.origins?.some(origin => Array.isArray(origin.localStorage) && origin.localStorage.length > 0),
    );
  } catch {
    return false;
  }
}

/** Safely checks whether the framework sessionStorage snapshot contains at least one persisted entry. */
export function sessionStorageHasData(file: string): boolean {
  if (!fs.existsSync(file)) return false;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as SessionStorageSnapshot;
    return parsed.version === 1 && parsed.origins.some(origin => Object.keys(origin.entries ?? {}).length > 0);
  } catch {
    return false;
  }
}

/** Captures the current page origin's sessionStorage into the framework's versioned snapshot format. */
export async function captureSessionStorage(page: Page): Promise<SessionStorageSnapshot> {
  const result = await page.evaluate(() => ({
    origin: window.location.origin,
    entries: Object.fromEntries(Array.from({ length: sessionStorage.length }, (_, index) => {
      const key = sessionStorage.key(index);
      return key === null ? undefined : [key, sessionStorage.getItem(key) ?? ''];
    }).filter((entry): entry is [string, string] => Boolean(entry))),
  }));
  return { version: 1, origins: [result] };
}

/** Atomically persists a versioned sessionStorage snapshot with restricted file permissions. */
export function writeSessionStorageSnapshot(file: string, snapshot: SessionStorageSnapshot): void {
  atomicWriteJson(file, snapshot);
}

/** Reads a valid versioned sessionStorage snapshot, returning undefined for missing or malformed state. */
export function readSessionStorageSnapshot(file: string): SessionStorageSnapshot | undefined {
  if (!fs.existsSync(file)) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as SessionStorageSnapshot;
    return parsed.version === 1 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Reads auth lifecycle metadata when present and compatible with the current metadata version. */
export function readAuthStateMetadata(file: string | undefined): AuthStateMetadata | undefined {
  if (!file || !fs.existsSync(file)) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as AuthStateMetadata;
    return parsed.version === 1 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Atomically writes verified auth lifecycle metadata without exposing credential contents. */
export function writeAuthStateMetadata(file: string, metadata: AuthStateMetadata): void {
  atomicWriteJson(file, metadata);
}

/** Atomically writes Playwright browser storage state produced by a verified auth provider. */
export function writeBrowserStorageState(file: string, state: BrowserStorageState): void {
  atomicWriteJson(file, state);
}

/** Installs persisted sessionStorage through an init script so new pages start with the verified session state. */
export async function installSessionStorageSnapshot(
  context: BrowserContext,
  snapshot: SessionStorageSnapshot | undefined,
): Promise<void> {
  if (!snapshot?.origins.length) return;
  await context.addInitScript((payload: SessionStorageSnapshot) => {
    const state = payload.origins.find(item => item.origin === window.location.origin);
    if (!state) return;
    for (const [key, value] of Object.entries(state.entries)) sessionStorage.setItem(key, value);
  }, snapshot);
}

/** Applies persisted localStorage to an already-open page after live auth refresh. */
export async function applyLocalStorageStateToPage(page: Page, storageStateFile: string): Promise<void> {
  if (page.isClosed() || !fs.existsSync(storageStateFile)) return;
  let origins: Array<{ origin: string; localStorage?: Array<{ name: string; value: string }> }>;
  try {
    const parsed = JSON.parse(fs.readFileSync(storageStateFile, 'utf8')) as {
      origins?: Array<{ origin: string; localStorage?: Array<{ name: string; value: string }> }>;
    };
    origins = parsed.origins ?? [];
  } catch {
    return;
  }
  await page.evaluate((payload) => {
    const state = payload.find(item => item.origin === window.location.origin);
    if (!state) return;
    localStorage.clear();
    for (const entry of state.localStorage ?? []) localStorage.setItem(entry.name, entry.value);
  }, origins).catch(() => undefined);
}

/** Applies sessionStorage to an already-open page after live auth refresh. */
export async function applySessionStorageSnapshotToPage(
  page: Page,
  snapshot: SessionStorageSnapshot | undefined,
): Promise<void> {
  if (!snapshot?.origins.length || page.isClosed()) return;
  await page.evaluate((payload: SessionStorageSnapshot) => {
    const state = payload.origins.find(item => item.origin === window.location.origin);
    if (!state) return;
    sessionStorage.clear();
    for (const [key, value] of Object.entries(state.entries)) sessionStorage.setItem(key, value);
  }, snapshot).catch(() => undefined);
}

/**
 * Uses configured auth stateKey only as a freshness hint. JWT signatures are not trusted here;
 * actual authentication is always proven by the project verification contract in a browser.
 */
export function inferConfiguredAuthExpiry(
  paths: ResolvedAuthStatePaths,
  verification: ProjectAuthVerificationConfig | undefined,
): Date | undefined {
  const key = verification?.stateKey;
  if (!key) return undefined;
  const candidates: string[] = [];
  if (key.storage !== 'session' && paths.storageStatePath && fs.existsSync(paths.storageStatePath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(paths.storageStatePath, 'utf8')) as {
        origins?: Array<{ localStorage?: Array<{ name: string; value: string }> }>;
      };
      for (const origin of parsed.origins ?? []) {
        for (const entry of origin.localStorage ?? []) if (entry.name === key.name) candidates.push(entry.value);
      }
    } catch { /* invalid state is handled by verification */ }
  }
  if (key.storage !== 'local' && paths.sessionStoragePath) {
    const snapshot = readSessionStorageSnapshot(paths.sessionStoragePath);
    for (const origin of snapshot?.origins ?? []) {
      const value = origin.entries[key.name];
      if (value) candidates.push(value);
    }
  }
  for (const value of candidates) {
    const expiry = jwtExpiry(value);
    if (expiry) return expiry;
  }
  return undefined;
}

/** Normalizes a provider-supplied expiry value to ISO-8601 for consistent refresh planning metadata. */
export function normalizeAuthExpiry(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
}

function jwtExpiry(token: string): Date | undefined {
  const parts = token.split('.');
  if (parts.length !== 3) return undefined;
  try {
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as { exp?: unknown };
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return undefined;
    return new Date(payload.exp * 1000);
  } catch {
    return undefined;
  }
}

function atomicWriteJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  try {
    fs.renameSync(temp, file);
  } catch (error) {
    // Windows may reject replacement of an existing file; preserve correctness with a copy fallback.
    try {
      fs.copyFileSync(temp, file);
      fs.rmSync(temp, { force: true });
    } catch {
      try { fs.rmSync(temp, { force: true }); } catch { /* best effort */ }
      throw error;
    }
  }
}
