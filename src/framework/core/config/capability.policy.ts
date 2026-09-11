import type { ResolvedDatabaseCapability } from './config.types';

/** Returns true when a test explicitly declares database dependency through @db/@database. */
export function requiresDatabaseCapability(titlePath: string[], tags: string[] = []): boolean {
  return /@(?:db|database)\b/i.test([...titlePath, ...tags].join(' '));
}

/**
 * Returns a framework-owned skip reason only when database use is optional and unavailable.
 * Required-but-unavailable database configuration is intentionally not skipped: preflight/doctor must fail fast.
 */
export function optionalDatabaseSkipReason(database: ResolvedDatabaseCapability): string | undefined {
  if (database.enabled || database.required) return undefined;
  return database.type === 'none'
    ? 'Database capability is optional and disabled for this project/environment.'
    : `Database capability is optional but not ready; missing: ${database.missingConfiguration.join(', ')}.`;
}
