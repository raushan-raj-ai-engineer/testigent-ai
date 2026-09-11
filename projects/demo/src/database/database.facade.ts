import type { DatabaseClient } from '../../../../src/framework/database/database.client';
import { OrderRepository } from './order.repository';

/** Domain repository entrypoint exposed by the demo project fixture. */
export class DemoRepositoryFacade {
  readonly orders: OrderRepository;
  constructor(db: DatabaseClient) { this.orders = new OrderRepository(db); }
}
