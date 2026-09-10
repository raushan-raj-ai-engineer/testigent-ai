/** External publishing must stay off by default. Author: Raushan Raj */
import { test, expect } from '@playwright/test'; import { envFlag } from '../../src/framework/intelligence/core/flags.js';
test('execution status publishing defaults to disabled',()=>{const before=process.env.EXECUTION_STATUS_PUBLISH_ENABLED;delete process.env.EXECUTION_STATUS_PUBLISH_ENABLED;expect(envFlag('EXECUTION_STATUS_PUBLISH_ENABLED',false)).toBe(false);if(before!==undefined)process.env.EXECUTION_STATUS_PUBLISH_ENABLED=before;});
