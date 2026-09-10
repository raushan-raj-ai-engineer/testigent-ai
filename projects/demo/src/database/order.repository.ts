import type { DatabaseClient } from '../../../../src/framework/database/database.client';

export interface OrderRecord { id: string; status: string; [key: string]: unknown; }

/**
 * Author: Raushan Raj
 * Business Use: Keeps business-oriented DB queries outside tests.
 * How to use: new OrderRepository(db).findById(orderId). Repositories use '?' placeholders for portability.
 * Benefit: SQL/schema changes are isolated from test scenarios and can be reviewed centrally.
 */
export class OrderRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findById(orderId: string): Promise<OrderRecord | undefined> {
    const rows = await this.db.query<OrderRecord>('SELECT id, status FROM orders WHERE id = ?', [orderId]);
    return rows[0];
  }
}
