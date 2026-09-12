import type { DatabaseClient } from './database.client';
import type { DatabaseType } from '../core/config/config.types';
import { NullDatabaseClient } from './null.database';
import { PostgresDatabaseClient } from './postgres.database';
import { MysqlDatabaseClient } from './mysql.database';
import { MssqlDatabaseClient } from './mssql.database';

/**
 * Author: Raushan Raj
 * Business Use: Selects the DB implementation from the resolved project/environment capability.
 * How to use: Framework fixtures pass the resolved runtime database type; tests only depend on DatabaseClient.
 * Benefit: Supports product teams with different database technologies using one framework API.
 */
export class DatabaseFactory {
  static create(type: DatabaseType = 'none'): DatabaseClient {
    switch (type) {
      case 'postgres': return new PostgresDatabaseClient();
      case 'mysql': return new MysqlDatabaseClient();
      case 'mssql': return new MssqlDatabaseClient();
      case 'none': return new NullDatabaseClient();
      default: throw new Error(`Unsupported database type: ${type}`);
    }
  }
}
