import type { DatabaseClient } from './database.client';

/**
 * Author: Raushan Raj
 * Business Use: MySQL adapter behind the common DB contract.
 * How to use: Set DB_TYPE=mysql; repositories use '?' placeholders.
 * Benefit: Product repositories remain portable across supported database engines.
 */
export class MysqlDatabaseClient implements DatabaseClient {
  readonly dialect = 'mysql' as const;
  private pool: any;
  constructor() {
    const mysql = require('mysql2/promise');
    this.pool = mysql.createPool({
      host: process.env.DB_HOST, port: Number(process.env.DB_PORT ?? 3306), database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD
    });
  }
  async query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await this.pool.execute(sql, params);
    return rows as T[];
  }
  async close(): Promise<void> { await this.pool.end(); }
}
