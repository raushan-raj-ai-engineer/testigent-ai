import type { DatabaseClient } from './database.client';

/**
 * Author: Raushan Raj
 * Business Use: PostgreSQL adapter implementing the common database contract.
 * How to use: Select postgres in projects/<project>/config/<env>.json and provide DB_* secret environment values. Repositories use '?' placeholders.
 * Benefit: DB technology can change without changing business tests/repositories.
 */
export class PostgresDatabaseClient implements DatabaseClient {
  readonly dialect = 'postgres' as const;
  private pool: any;
  constructor() {
    const { Pool } = require('pg');
    this.pool = new Pool({
      host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 5432), database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
    });
  }
  async query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    let index = 0;
    const postgresSql = sql.replace(/\?/g, () => `$${++index}`);
    const result = await this.pool.query(postgresSql, params);
    return result.rows as T[];
  }
  async close(): Promise<void> { await this.pool.end(); }
}
