import type { BaseApiClient } from '../../../../src/framework/api/base-api.client';

/** Domain API entrypoint. Add typed services as readonly properties; do not expose raw request contexts to tests. */
export class ProjectApiFacade {
  constructor(_client: BaseApiClient) {}
}
