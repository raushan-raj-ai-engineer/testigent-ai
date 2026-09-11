import { expect, test } from '@playwright/test';
import { assertCapabilityCatalogMatchesSchema } from '../../src/framework/declarative/scenario.capabilities';
import { buildDeclarativeJsonSchema } from '../../src/framework/declarative/scenario.json-schema';
import { validateScenario } from '../../src/framework/declarative/scenario.loader';
import { SUPPORTED_DECLARATIVE_ACTIONS } from '../../src/framework/declarative/scenario.schema';
import { resolveDeclarativeNavigationUrl } from '../../src/framework/declarative/scenario.navigation';

test.describe('declarative authoring contract', () => {
  test('accepts a governed linear UI scenario', () => {
    const scenario = validateScenario({
      id: 'login-valid-user',
      title: 'Valid user can sign in',
      tags: ['@smoke'],
      steps: [
        { action: 'goto', url: '/login' },
        { action: 'fill', by: 'label', value: 'Email', text: 'qa@example.com' },
        { action: 'click', by: 'role', role: 'button', name: 'Sign in' },
        { action: 'expectVisible', by: 'text', value: 'Welcome' },
      ],
    });
    expect(scenario.schemaVersion).toBe(1);
    expect(scenario.kind).toBe('ui');
  });

  test('rejects unsupported actions with authoring guidance', () => {
    expect(() => validateScenario({
      id: 'bad-action',
      title: 'Bad action',
      steps: [{ action: 'executeShell', command: 'rm -rf /' }],
    })).toThrow(/scenario:help/);
  });

  test('rejects invalid locator contracts before browser execution', () => {
    expect(() => validateScenario({
      id: 'bad-role',
      title: 'Bad role locator',
      steps: [{ action: 'click', by: 'role', name: 'Submit' }],
    })).toThrow(/steps/);
  });

  test('treats slash paths as application-root relative when base URL has a path', () => {
    expect(resolveDeclarativeNavigationUrl('https://demo.playwright.dev/todomvc', '/')).toBe('https://demo.playwright.dev/todomvc/');
    expect(resolveDeclarativeNavigationUrl('https://demo.playwright.dev/todomvc', '/completed')).toBe('https://demo.playwright.dev/todomvc/completed');
    expect(resolveDeclarativeNavigationUrl('https://demo.playwright.dev/todomvc', '/todomvc/')).toBe('https://demo.playwright.dev/todomvc/');
  });

  test('blocks cross-origin navigation unless explicitly governed', () => {
    delete process.env.DECLARATIVE_ALLOW_EXTERNAL_NAVIGATION;
    expect(() => resolveDeclarativeNavigationUrl('https://example.test/app', 'https://other.test/')).toThrow(/cross-origin/);
  });

  test('keeps capability catalog and IDE schema aligned', () => {
    assertCapabilityCatalogMatchesSchema();
    const schema = buildDeclarativeJsonSchema();
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema['x-testigent-locator-strategies']).toContain('role');

    const schemaActions = new Set(
      (((schema.properties as Record<string, any>).steps as Record<string, any>).items.oneOf as Array<Record<string, any>>)
        .map(branch => branch.properties?.action?.const)
        .filter(Boolean),
    );
    expect([...schemaActions].sort()).toEqual([...SUPPORTED_DECLARATIVE_ACTIONS].sort());
  });
});
