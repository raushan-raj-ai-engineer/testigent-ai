/** Resilient HTTP client for external project-management connectors. Author: Raushan Raj */

export interface ConnectorHttpOptions {
  timeoutMs?: number;
  retries?: number;
  retryableStatuses?: number[];
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function safeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return raw.split('?')[0] ?? raw;
  }
}

function retryAfterMs(response: Response, attempt: number): number {
  const max = envInt('CONNECTOR_MAX_BACKOFF_MS', 5000);
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(max, Math.max(0, seconds * 1000));
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.min(max, Math.max(0, date - Date.now()));
  }

  const githubReset = Number(response.headers.get('x-ratelimit-reset'));
  if (Number.isFinite(githubReset) && githubReset > 0) {
    return Math.min(max, Math.max(0, githubReset * 1000 - Date.now()));
  }

  const base = envInt('CONNECTOR_RETRY_BACKOFF_MS', 250);
  return Math.min(max, base * Math.max(1, 2 ** attempt));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function connectorJson<T = unknown>(
  url: string,
  init: RequestInit = {},
  options: ConnectorHttpOptions = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? envInt('CONNECTOR_TIMEOUT_MS', 15000);
  const retries = options.retries ?? envInt('CONNECTOR_MAX_RETRIES', 2);
  const retryable = new Set(options.retryableStatuses ?? [408, 425, 429, 500, 502, 503, 504]);
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (response.ok) {
        if (response.status === 204) return {} as T;
        const text = await response.text();
        return (text ? JSON.parse(text) : {}) as T;
      }

      if (attempt < retries && retryable.has(response.status)) {
        await sleep(retryAfterMs(response, attempt));
        continue;
      }

      throw new Error(`Connector HTTP ${response.status} ${response.statusText || ''} for ${safeUrl(url)}`.trim());
    } catch (error) {
      lastError = error;
      const retryableNetworkError = error instanceof TypeError || (error instanceof Error && error.name === 'AbortError');
      if (attempt < retries && retryableNetworkError) {
        await sleep(Math.min(envInt('CONNECTOR_MAX_BACKOFF_MS', 5000), envInt('CONNECTOR_RETRY_BACKOFF_MS', 250) * Math.max(1, 2 ** attempt)));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Connector request failed for ${safeUrl(url)}`);
}

export function connectorBoolean(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value == null || value.trim() === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function jsonPointerSegment(value: string): string {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}
