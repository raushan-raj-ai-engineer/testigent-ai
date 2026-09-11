import fs from 'node:fs';
import path from 'node:path';
import type { BrowserContext, Page } from '@playwright/test';
import type { ProjectAuthConfig } from './config/config.types';

export interface SessionStorageSnapshot {
  version: 1;
  origins: Array<{ origin: string; entries: Record<string, string> }>;
}

export interface ResolvedAuthStatePaths {
  storageStatePath?: string;
  sessionStoragePath?: string;
}

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
  };
}

export function hasPersistedAuthState(paths: ResolvedAuthStatePaths): boolean {
  const hasStorage = Boolean(paths.storageStatePath && storageStateHasData(paths.storageStatePath));
  const hasSession = Boolean(paths.sessionStoragePath && sessionStorageHasData(paths.sessionStoragePath));
  return hasStorage || hasSession;
}

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

export function sessionStorageHasData(file: string): boolean {
  if (!fs.existsSync(file)) return false;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as SessionStorageSnapshot;
    return parsed.version === 1 && parsed.origins.some(origin => Object.keys(origin.entries ?? {}).length > 0);
  } catch {
    return false;
  }
}

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

export function writeSessionStorageSnapshot(file: string, snapshot: SessionStorageSnapshot): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
}

export function readSessionStorageSnapshot(file: string): SessionStorageSnapshot | undefined {
  if (!fs.existsSync(file)) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as SessionStorageSnapshot;
    return parsed.version === 1 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

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
