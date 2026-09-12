import type { DatabaseClient } from '../../../../src/framework/database/database.client';

/** Project repository entrypoint. SQL stays here rather than in business specs. */
export class SdetPracticeRepositoryFacade {
  constructor(private readonly db: DatabaseClient) {}

  async healthCheck(): Promise<boolean> {
    const rows = await this.db.query<{ ok: number }>('SELECT 1 AS ok');
    return rows.length > 0 && rows[0]?.ok === 1;
  }
}
