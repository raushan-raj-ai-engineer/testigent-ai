import type { BaseApiClient } from '../../../../src/framework/api/base-api.client';
import { UserApi } from './user.api';

export class DemoApiFacade {
  readonly users: UserApi;
  constructor(client: BaseApiClient) {
    this.users = new UserApi(client);
  }
}
