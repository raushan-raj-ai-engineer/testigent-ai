import type { DatabaseClient } from './database.client';
import { NullDatabaseClient } from './null.database';
import { PostgresDatabaseClient } from './postgres.database';
import { MysqlDatabaseClient } from './mysql.database';
import { MssqlDatabaseClient } from './mssql.database';

/**
 * Author: Raushan Raj
 * Business Use: Selects the DB implementation from environment configuration.
 * How to use: DatabaseFactory.create(); tests only depend on DatabaseClient.
 * Benefit: Supports product teams with different database technologies using one framework API.
 */
export class DatabaseFactory {
  static create(): DatabaseClient {
    switch ((process.env.DB_TYPE ?? 'none').toLowerCase()) {
      case 'postgres': return new PostgresDatabaseClient();
      case 'mysql': return new MysqlDatabaseClient();
      case 'mssql': return new MssqlDatabaseClient();
      case 'none': return new NullDatabaseClient();
      default: throw new Error(`Unsupported DB_TYPE: ${process.env.DB_TYPE}`);
    }
  }
}
