/** Author: Raushan Raj */
export type DatabaseDialect = 'none' | 'postgres' | 'mysql' | 'mssql';

export interface DatabaseClient {
  readonly dialect: DatabaseDialect;
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}
