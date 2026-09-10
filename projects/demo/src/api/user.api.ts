import { expect } from '@playwright/test';
import type { BaseApiClient } from '../../../../src/framework/api/base-api.client';

export interface DemoUser { id?: number; name: string; email: string; }

/**
 * Author: Raushan Raj
 * Business Use: Domain-specific user/customer API operations.
 * How to use: api.users.getUser(id) or api.users.createUser(payload).
 * Benefit: Business tests avoid raw endpoints, methods and response parsing.
 */
export class UserApi {
  constructor(private readonly client: BaseApiClient) {}

  async getUser(id: number): Promise<DemoUser> {
    const response = await this.client.get(`/users/${id}`);
    expect(response.ok()).toBeTruthy();
    return (await response.json()) as DemoUser;
  }

  async createUser(user: DemoUser): Promise<DemoUser> {
    const response = await this.client.post('/users', { data: user });
    expect(response.status()).toBe(201);
    return (await response.json()) as DemoUser;
  }
}
