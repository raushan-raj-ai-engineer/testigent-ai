import { createHash } from 'node:crypto';

export type DataIdentityMode = 'stable' | 'attempt' | 'idempotent';

export interface DataScopeContext {
  runId: string;
  application: string;
  environment?: string;
  testId: string;
  retry: number;
  parallelIndex: number;
  caseId?: string;
}

/**
 * Author: Raushan Raj
 * Business Use: Produces collision-resistant entity names for parallel tests and retries.
 * Modes: stable = same within one run across retries; attempt = unique per retry/worker; idempotent = same logical owner across runs.
 * Benefit: Parallel execution can safely create/update external records without relying on shared mutable accounts.
 */
export class DataScope {
  constructor(private readonly context: DataScopeContext) {}

  /** Returns a bounded, human-readable identity for a named test-data resource. */
  identity(name: string, mode: DataIdentityMode = 'attempt', maxLength = 63): string {
    if (!name.trim()) throw new Error('Data identity name is required.');
    if (!Number.isInteger(maxLength) || maxLength < 16) throw new Error('Data identity maxLength must be an integer >= 16.');
    const environment = this.context.environment?.trim() || 'default-env';
    // testId always participates so identical case IDs in separate suites/files cannot collide.
    const logical = [this.context.testId, this.context.caseId?.trim()].filter(Boolean).join('|');
    const parts = mode === 'idempotent'
      ? [this.context.application, environment, logical, name]
      : mode === 'stable'
        ? [this.context.runId, this.context.application, environment, logical, name]
        : [this.context.runId, this.context.application, environment, logical, name, `r${this.context.retry}`, `p${this.context.parallelIndex}`];
    const raw = parts.join('|');
    const hash = createHash('sha256').update(raw).digest('hex').slice(0, 10);
    const prefixBudget = maxLength - hash.length - 1;
    const prefix = slug(parts.join('-')).slice(0, prefixBudget).replace(/-+$/g, '') || 'data';
    return `${prefix}-${hash}`;
  }

  /** Returns a stable logical ownership key suitable for idempotent cleanup/upsert operations. */
  owner(name: string): string { return this.identity(name, 'idempotent', 96); }
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
