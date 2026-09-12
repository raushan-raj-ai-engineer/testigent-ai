import fs from 'node:fs';
import path from 'node:path';

export interface FileLockOptions {
  timeoutMs: number;
  staleMs: number;
  pollMs?: number;
}

export interface FileLockHandle {
  release(): void;
}

/**
 * Small cross-process lock used to prevent parallel workers from refreshing the same auth state simultaneously.
 * The file contains no credentials or tokens.
 */
export async function acquireFileLock(file: string, options: FileLockOptions): Promise<FileLockHandle> {
  const started = Date.now();
  const pollMs = options.pollMs ?? 100;
  fs.mkdirSync(path.dirname(file), { recursive: true });

  while (true) {
    try {
      const fd = fs.openSync(file, 'wx', 0o600);
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }));
      let released = false;
      return {
        release(): void {
          if (released) return;
          released = true;
          try { fs.closeSync(fd); } catch { /* best effort */ }
          try { fs.rmSync(file, { force: true }); } catch { /* best effort */ }
        },
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') throw error;
      if (isStale(file, options.staleMs)) {
        try { fs.rmSync(file, { force: true }); } catch { /* another process may own/remove it */ }
        continue;
      }
      if (Date.now() - started >= options.timeoutMs) {
        throw new Error(`AUTH_REFRESH_LOCK_TIMEOUT: timed out waiting for auth refresh lock '${file}'.`);
      }
      await new Promise(resolve => setTimeout(resolve, pollMs));
    }
  }
}

function isStale(file: string, staleMs: number): boolean {
  try {
    const age = Date.now() - fs.statSync(file).mtimeMs;
    if (age <= staleMs) return false;
    try {
      const payload = JSON.parse(fs.readFileSync(file, 'utf8')) as { pid?: unknown };
      if (typeof payload.pid === 'number' && Number.isInteger(payload.pid) && isProcessAlive(payload.pid)) return false;
    } catch { /* unreadable lock falls back to age-based recovery */ }
    return true;
  } catch {
    return false;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === 'EPERM';
  }
}
