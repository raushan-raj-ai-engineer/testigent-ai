import type { DatabaseClient } from './database.client';
import { resolveDatabaseTlsPolicy } from './database-tls.js';
import { rewriteQuestionMarkParameters } from './sql-placeholder.js';

/** PostgreSQL adapter implementing the common database contract with verified TLS by default. */
export class PostgresDatabaseClient implements DatabaseClient {
  readonly dialect = 'postgres' as const;
  private pool: any;
  constructor() {
    const { Pool } = require('pg');
    this.pool = new Pool(buildPostgresPoolConfig());
  }
  async query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const rewritten = rewriteQuestionMarkParameters(sql, index => `$${index + 1}`, { preservePostgresJsonOperators: true });
    if (rewritten.count !== params.length) throw new Error(`SQL_PARAMETER_COUNT: expected ${rewritten.count} value(s), received ${params.length}.`);
    const result = await this.pool.query(rewritten.sql, params);
    return result.rows as T[];
  }
  async close(): Promise<void> { await this.pool.end(); }
}

/** Builds PostgreSQL pool options with the shared verified-TLS policy. */
export function buildPostgresPoolConfig(env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  const tls = resolveDatabaseTlsPolicy(env);
  return {
    host: env.DB_HOST, port: Number(env.DB_PORT ?? 5432), database: env.DB_NAME,
    user: env.DB_USER, password: env.DB_PASSWORD,
    ssl: tls.enabled ? { rejectUnauthorized: tls.rejectUnauthorized, ...(tls.ca ? { ca: tls.ca } : {}) } : undefined,
  };
}
