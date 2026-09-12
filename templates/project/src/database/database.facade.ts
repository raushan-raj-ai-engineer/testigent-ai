import type { DatabaseClient } from '../../../../src/framework/database/database.client';

/** Domain repository entrypoint. Add typed repositories as readonly properties; keep SQL out of tests. */
export class ProjectRepositoryFacade {
  constructor(_db: DatabaseClient) {}
}
