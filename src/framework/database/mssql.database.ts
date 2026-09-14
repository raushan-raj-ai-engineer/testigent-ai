import type { DatabaseClient } from './database.client';
import { resolveDatabaseTlsPolicy } from './database-tls.js';
import { rewriteQuestionMarkParameters } from './sql-placeholder.js';

/** SQL Server adapter behind the common DB contract with verified TLS by default. */
export class MssqlDatabaseClient implements DatabaseClient {
  readonly dialect = 'mssql' as const;
  private poolPromise: Promise<any>;
  constructor() {
    const sql = require('mssql');
    this.poolPromise = new sql.ConnectionPool(buildMssqlPoolConfig()).connect();
  }
  async query<T extends Record<string, unknown>>(sqlText: string, params: unknown[] = []): Promise<T[]> {
    const rewritten = rewriteQuestionMarkParameters(sqlText, index => `@p${index}`);
    if (rewritten.count !== params.length) throw new Error(`SQL_PARAMETER_COUNT: expected ${rewritten.count} value(s), received ${params.length}.`);
    const pool = await this.poolPromise;
    const request = pool.request();
    params.forEach((value, index) => request.input(`p${index}`, value));
    const result = await request.query(rewritten.sql);
    return result.recordset as T[];
  }
  async close(): Promise<void> { const pool = await this.poolPromise; await pool.close(); }
}

/** Builds SQL Server pool options with encryption and certificate verification policy. */
export function buildMssqlPoolConfig(env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  const tls = resolveDatabaseTlsPolicy(env);
  return {
    server: env.DB_HOST,
    port: Number(env.DB_PORT ?? 1433),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    options: {
      encrypt: tls.enabled,
      trustServerCertificate: tls.enabled ? !tls.rejectUnauthorized : false,
      ...(tls.ca ? { cryptoCredentialsDetails: { ca: tls.ca } } : {}),
    },
  };
}
