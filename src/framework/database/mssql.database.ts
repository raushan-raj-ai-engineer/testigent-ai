import type { DatabaseClient } from './database.client';

/**
 * Author: Raushan Raj
 * Business Use: SQL Server adapter behind the common DB contract.
 * How to use: Select mssql in projects/<project>/config/<env>.json and provide DB_* secret environment values; repositories use '?' placeholders which this adapter maps to named parameters.
 * Benefit: Business repositories avoid SQL-driver-specific parameter syntax.
 */
export class MssqlDatabaseClient implements DatabaseClient {
  readonly dialect = 'mssql' as const;
  private poolPromise: Promise<any>;
  constructor() {
    const sql = require('mssql');
    this.poolPromise = new sql.ConnectionPool({
      server: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 1433),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      options: { encrypt: process.env.DB_SSL === 'true', trustServerCertificate: true }
    }).connect();
  }
  async query<T extends Record<string, unknown>>(sqlText: string, params: unknown[] = []): Promise<T[]> {
    let index = 0;
    const names: string[] = [];
    const sql = sqlText.replace(/\?/g, () => {
      const name = `p${index++}`;
      names.push(name);
      return `@${name}`;
    });
    if (names.length !== params.length) throw new Error('SQL parameter count does not match values.');
    const pool = await this.poolPromise;
    const request = pool.request();
    names.forEach((name, i) => request.input(name, params[i]));
    const result = await request.query(sql);
    return result.recordset as T[];
  }
  async close(): Promise<void> { const pool = await this.poolPromise; await pool.close(); }
}
