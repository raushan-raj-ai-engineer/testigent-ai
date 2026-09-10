import type { DatabaseClient, DatabaseDialect } from './database.client';
import type { EnterpriseLogger } from '../logging/enterprise.logger';

/**
 * Author: Raushan Raj
 * Business Use: Adds timing/error/row-count observability around database validations.
 * How to use: Enterprise fixture wraps the selected DB adapter automatically. Keep repository SQL parameterized.
 * Benefit: DB failures correlate with the same run/test logs without exposing credentials or raw parameter values.
 */
export class ObservedDatabaseClient implements DatabaseClient {
  readonly dialect: DatabaseDialect;
  constructor(private readonly inner: DatabaseClient, private readonly logger: EnterpriseLogger) { this.dialect = inner.dialect; }

  async query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const started = Date.now();
    try {
      const rows = await this.inner.query<T>(sql, params);
      this.logger.info('DB_QUERY', { dialect: this.dialect, sql: compact(sql), parameterCount: params.length, rowCount: rows.length, durationMs: Date.now() - started });
      return rows;
    } catch (error) {
      this.logger.error('DB_QUERY_FAILED', { dialect: this.dialect, sql: compact(sql), parameterCount: params.length, durationMs: Date.now() - started, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async close(): Promise<void> { await this.inner.close(); }
}

function compact(sql: string): string { return sql.replace(/\s+/g, ' ').trim().slice(0, 1000); }
