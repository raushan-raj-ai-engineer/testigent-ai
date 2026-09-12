import type { DatabaseClient } from './database.client';
import type { DatabaseType } from '../core/config/config.types';
import { NullDatabaseClient } from './null.database';
import { PostgresDatabaseClient } from './postgres.database';
import { MysqlDatabaseClient } from './mysql.database';
import { MssqlDatabaseClient } from './mssql.database';

/**
 * Author: Raushan Raj
 * Business Use: Selects the DB implementation from environment configuration.
 * How to use: Framework fixtures pass the resolved runtime database type; tests only depend on DatabaseClient.
 * Benefit: Supports product teams with different database technologies using one framework API.
 */
export class DatabaseFactory {
  static create(type: DatabaseType = normalizeType(process.env.DB_TYPE)): DatabaseClient {
    switch (type) {
      case 'postgres': return new PostgresDatabaseClient();
      case 'mysql': return new MysqlDatabaseClient();
      case 'mssql': return new MssqlDatabaseClient();
      case 'none': return new NullDatabaseClient();
      default: throw new Error(`Unsupported DB_TYPE: ${type}`);
    }
  }
}

function normalizeType(raw: string | undefined): DatabaseType {
  const value = (raw ?? 'none').trim().toLowerCase();
  if (value === 'none' || value === 'postgres' || value === 'mysql' || value === 'mssql') return value;
  throw new Error(`Unsupported DB_TYPE: ${raw}`);
}
