import type { DatabaseClient } from './database.client';
import { resolveDatabaseTlsPolicy } from './database-tls.js';

/** MySQL adapter behind the common DB contract with verified TLS support. */
export class MysqlDatabaseClient implements DatabaseClient {
  readonly dialect = 'mysql' as const;
  private pool: any;
  constructor() {
    const mysql = require('mysql2/promise');
    this.pool = mysql.createPool(buildMysqlPoolConfig());
  }
  async query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await this.pool.execute(sql, params);
    return rows as T[];
  }
  async close(): Promise<void> { await this.pool.end(); }
}

/** Builds MySQL pool options with the shared verified-TLS policy. */
export function buildMysqlPoolConfig(env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  const tls = resolveDatabaseTlsPolicy(env);
  return {
    host: env.DB_HOST, port: Number(env.DB_PORT ?? 3306), database: env.DB_NAME,
    user: env.DB_USER, password: env.DB_PASSWORD,
    ssl: tls.enabled ? { rejectUnauthorized: tls.rejectUnauthorized, ...(tls.ca ? { ca: tls.ca } : {}) } : undefined,
  };
}
