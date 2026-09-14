import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

interface BulkAdvisory {
  id?: string | number;
  source?: string | number;
  url?: string;
  title?: string;
  severity?: string;
  vulnerable_versions?: string;
  range?: string;
}

interface AuditFinding {
  severity: string;
  range: string;
  via: Array<{
    source: string;
    severity: string;
    range: string;
    title?: string;
    url?: string;
  }>;
}

export interface AuditLikeReport {
  auditReportVersion: number;
  vulnerabilities: Record<string, AuditFinding>;
}

const SEVERITY_RANK: Record<string, number> = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

/**
 * Builds the npm Bulk Advisory payload from lockfile v2/v3 package entries.
 * Each dependency name maps to every exact installed version in the tree.
 */
export function buildBulkAdvisoryPayload(lockfile: unknown): Record<string, string[]> {
  const packages = (lockfile as { packages?: unknown })?.packages;

  if (!packages || typeof packages !== 'object' || Array.isArray(packages)) {
    throw new Error('package-lock.json does not expose a supported packages map.');
  }

  const versions = new Map<string, Set<string>>();

  for (const [location, metadata] of Object.entries(packages)) {
    if (!location) continue;

    const version = (metadata as { version?: unknown })?.version;
    if (typeof version !== 'string' || !version.trim()) continue;

    const name = packageNameFromLockPath(location);
    if (!name) continue;

    const entries = versions.get(name) ?? new Set<string>();
    entries.add(version);
    versions.set(name, entries);
  }

  if (versions.size === 0) {
    throw new Error('No installed dependency versions were found in package-lock.json.');
  }

  return Object.fromEntries(
    [...versions.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, values]) => [
        name,
        [...values].sort((left, right) => left.localeCompare(right)),
      ]),
  );
}

/**
 * Converts npm Bulk Advisory responses into the audit shape consumed by
 * TestigentAI's advisory-specific security policy.
 */
export function normalizeBulkAdvisoryResponse(raw: unknown): AuditLikeReport {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('npm Bulk Advisory response must be a JSON object.');
  }

  const vulnerabilities: Record<string, AuditFinding> = {};

  for (const [packageName, value] of Object.entries(raw)) {
    if (!Array.isArray(value)) {
      throw new Error(`npm Bulk Advisory response for '${packageName}' must be an array.`);
    }

    if (value.length === 0) continue;

    const via: AuditFinding['via'] = [];
    const ranges = new Set<string>();
    let highestSeverity = 'info';

    for (const candidate of value) {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        throw new Error(`npm Bulk Advisory entry for '${packageName}' is malformed.`);
      }

      const advisory = candidate as BulkAdvisory;
      const severity = String(advisory.severity ?? '').toLowerCase();

      if (!(severity in SEVERITY_RANK)) {
        throw new Error(
          `npm Bulk Advisory entry for '${packageName}' has an invalid or missing severity.`,
        );
      }

      const advisoryId = advisory.id ?? advisory.source ?? advisory.url;
      if (advisoryId === undefined || advisoryId === null || String(advisoryId).trim() === '') {
        throw new Error(
          `npm Bulk Advisory entry for '${packageName}' has no stable advisory identifier.`,
        );
      }

      const affectedRange = String(
        advisory.vulnerable_versions ?? advisory.range ?? '*',
      );

      ranges.add(affectedRange);

      if (SEVERITY_RANK[severity]! > SEVERITY_RANK[highestSeverity]!) {
        highestSeverity = severity;
      }

      via.push({
        source: String(advisoryId),
        severity,
        range: affectedRange,
        title: typeof advisory.title === 'string' ? advisory.title : undefined,
        url: typeof advisory.url === 'string' ? advisory.url : undefined,
      });
    }

    vulnerabilities[packageName] = {
      severity: highestSeverity,
      range: [...ranges].sort().join(' || '),
      via,
    };
  }

  return {
    auditReportVersion: 2,
    vulnerabilities,
  };
}

/**
 * Queries npm's Bulk Advisory API using exact versions from package-lock.json.
 * Unlabelled gzip responses are decoded explicitly before JSON parsing.
 */
export async function fetchBulkAdvisoryAudit(options: {
  lockPath?: string;
  registry?: string;
  timeoutMs?: number;
} = {}): Promise<AuditLikeReport> {
  const lockPath = path.resolve(options.lockPath ?? 'package-lock.json');

  if (!fs.existsSync(lockPath)) {
    throw new Error(`Security audit lockfile is missing: ${lockPath}`);
  }

  const lockfile = JSON.parse(fs.readFileSync(lockPath, 'utf8')) as unknown;
  const payload = buildBulkAdvisoryPayload(lockfile);

  const registry = options.registry
    ?? process.env.SECURITY_AUDIT_REGISTRY
    ?? process.env.npm_config_registry
    ?? 'https://registry.npmjs.org/';

  let endpoint: URL;
  try {
    endpoint = new URL('/-/npm/v1/security/advisories/bulk', registry);
  } catch {
    throw new Error('Configured npm security audit registry is not a valid URL.');
  }

  if (!['https:', 'http:'].includes(endpoint.protocol)) {
    throw new Error('Configured npm security audit registry must use HTTP or HTTPS.');
  }

  const timeoutMs = options.timeoutMs ?? 20_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('Security audit timeout must be a positive integer.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'accept-encoding': 'identity',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`npm Bulk Advisory request timed out after ${timeoutMs}ms.`);
    }
    throw new Error(
      `npm Bulk Advisory request failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    clearTimeout(timer);
  }

  const wireBytes = Buffer.from(await response.arrayBuffer());

  // npm registry has historically emitted gzip bytes without Content-Encoding.
  // Detect the gzip magic bytes so the security gate remains deterministic.
  const decodedBytes =
    wireBytes.length >= 2
    && wireBytes[0] === 0x1f
    && wireBytes[1] === 0x8b
      ? gunzipSync(wireBytes)
      : wireBytes;

  if (!response.ok) {
    throw new Error(
      `npm Bulk Advisory endpoint returned HTTP ${response.status}.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodedBytes.toString('utf8'));
  } catch {
    throw new Error('npm Bulk Advisory endpoint did not return valid JSON.');
  }

  return normalizeBulkAdvisoryResponse(parsed);
}

function packageNameFromLockPath(location: string): string | undefined {
  const marker = 'node_modules/';
  const index = location.lastIndexOf(marker);
  if (index < 0) return undefined;

  const suffix = location.slice(index + marker.length);
  if (!suffix) return undefined;

  const segments = suffix.split('/');

  if (segments[0]?.startsWith('@')) {
    if (!segments[1]) return undefined;
    return `${segments[0]}/${segments[1]}`;
  }

  return segments[0] || undefined;
}
