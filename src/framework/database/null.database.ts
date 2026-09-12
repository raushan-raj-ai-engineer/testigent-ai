import type { DatabaseClient } from './database.client';

/**
 * Author: Raushan Raj
 * Business Use: Explicit no-database mode for projects/environments that do not require DB validation.
 * How to use: Keep database.type=none in the selected project/environment configuration.
 * Benefit: UI/API suites do not need database infrastructure to execute.
 */
export class NullDatabaseClient implements DatabaseClient {
  readonly dialect = 'none' as const;

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<T[]> {
    void sql;
    void params;
    throw new Error('Database is disabled for the selected project/environment. Configure capabilities.database.type and DB_* connection secrets before using DB validation.');
  }

  async close(): Promise<void> {}
}
