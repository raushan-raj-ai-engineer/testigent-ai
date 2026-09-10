import { test as frameworkTest, expect } from '../../../src/framework/core/fixtures/enterprise.fixture';

/** Project-owned fixture extension. Add only project-specific facades here. */
export const test = frameworkTest.extend<Record<string, never>>({});
export { expect };
