import net from 'node:net';

export interface AiDestinationDecision {
  origin: string;
  locality: 'loopback' | 'private' | 'external';
  approvedBy: 'loopback-policy' | 'private-allowlist' | 'external-allowlist';
}

/**
 * Enforces destination policy from the resolved URL rather than trusting a provider label.
 * Every AI adapter and every redirect passes through this boundary before network activity.
 */
export function assertAiDestinationAllowed(rawUrl: string, env: NodeJS.ProcessEnv = process.env): AiDestinationDecision {
  let url: URL;
  try { url = new URL(rawUrl); } catch { throw new Error(`AI_EGRESS_INVALID_URL: '${rawUrl}' is not a valid absolute URL.`); }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`AI_EGRESS_BLOCKED: unsupported transport '${url.protocol}' for ${safeOrigin(url)}.`);
  }

  const origin = url.origin;
  const privateAllowlist = parseOrigins(env.AI_ALLOWED_PRIVATE_ORIGINS);
  const externalAllowlist = parseOrigins(env.AI_ALLOWED_EXTERNAL_ORIGINS);
  const loopback = isLoopbackHost(url.hostname);
  const privateAddress = isPrivateIp(url.hostname);

  if (loopback) {
    if ((env.AI_ALLOW_LOOPBACK_EGRESS ?? 'true').toLowerCase() !== 'true') {
      throw new Error(`AI_EGRESS_BLOCKED: loopback destination ${origin} is disabled by AI_ALLOW_LOOPBACK_EGRESS.`);
    }
    return { origin, locality: 'loopback', approvedBy: 'loopback-policy' };
  }

  if (privateAllowlist.has(origin)) {
    return { origin, locality: privateAddress ? 'private' : 'private', approvedBy: 'private-allowlist' };
  }

  if (privateAddress) {
    throw new Error(
      `AI_EGRESS_BLOCKED: private destination ${origin} is not approved. Add the exact origin to AI_ALLOWED_PRIVATE_ORIGINS.`
    );
  }

  if (url.protocol !== 'https:') {
    throw new Error(`AI_EGRESS_BLOCKED: external AI destination ${origin} must use HTTPS.`);
  }
  if (env.AI_ALLOW_CLOUD_EGRESS !== 'true') {
    throw new Error(`AI_EGRESS_BLOCKED: external destination ${origin} requires AI_ALLOW_CLOUD_EGRESS=true.`);
  }

  if (externalAllowlist.has(origin)) {
    return { origin, locality: 'external', approvedBy: 'external-allowlist' };
  }

  throw new Error(
    `AI_EGRESS_BLOCKED: external destination ${origin} is not approved. Add the exact origin to AI_ALLOWED_EXTERNAL_ORIGINS.`
  );
}

/** Returns normalized private/external AI origin allowlists for diagnostics and preflight output. */
export function approvedAiOrigins(env: NodeJS.ProcessEnv = process.env): { privateOrigins: string[]; externalOrigins: string[] } {
  return {
    privateOrigins: [...parseOrigins(env.AI_ALLOWED_PRIVATE_ORIGINS)].sort(),
    externalOrigins: [...parseOrigins(env.AI_ALLOWED_EXTERNAL_ORIGINS)].sort(),
  };
}

function parseOrigins(raw?: string): Set<string> {
  const out = new Set<string>();
  for (const item of (raw ?? '').split(',').map(value => value.trim()).filter(Boolean)) {
    let url: URL;
    try { url = new URL(item); } catch { throw new Error(`Invalid AI origin '${item}'. Use comma-separated absolute origins.`); }
    if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
      throw new Error(`Invalid AI origin '${item}'. Allowlist entries must be origins only, for example https://ai.example.com.`);
    }
    out.add(url.origin);
  }
  return out;
}

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost');
}

function isPrivateIp(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '');
  const family = net.isIP(host);
  if (family === 4) {
    const parts = host.split('.').map(Number);
    return parts[0] === 10
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168)
      || (parts[0] === 169 && parts[1] === 254);
  }
  if (family === 6) {
    const normalized = host.toLowerCase();
    return normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
  }
  return false;
}

function safeOrigin(url: URL): string {
  return `${url.protocol}//${url.host}`;
}
