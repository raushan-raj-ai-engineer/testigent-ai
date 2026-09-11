import {
  SCENARIO_SCHEMA_VERSION,
  SUPPORTED_ARIA_ROLES,
  SUPPORTED_LOCATOR_STRATEGIES,
} from './scenario.constants';

export type JsonSchema = Record<string, unknown>;

/** Builds the committed IDE JSON Schema from the same action/locator constants used by runtime validation. */
export function buildDeclarativeJsonSchema(): JsonSchema {
  const locatorBranches = buildLocatorBranches();
  const locatorAction = (action: string, extra: JsonSchema = {}): JsonSchema[] => locatorBranches.map(locator => ({
    type: 'object',
    additionalProperties: false,
    properties: {
      action: { const: action },
      ...(locator.properties as Record<string, unknown>),
      ...(extra.properties as Record<string, unknown> | undefined),
    },
    required: [
      'action',
      ...((locator.required as string[]) ?? []),
      ...((extra.required as string[]) ?? []),
    ],
  }));

  const stepBranches: JsonSchema[] = [
    {
      title: 'Navigate',
      type: 'object',
      additionalProperties: false,
      properties: {
        action: { const: 'goto' },
        url: {
          type: 'string',
          minLength: 1,
          description: 'Application-relative path (recommended) or an http(s) URL. External origins are blocked by default.',
          pattern: '^(?:https?://|/|\\./)',
          examples: ['/', '/orders', 'https://example.test/app'],
        },
      },
      required: ['action', 'url'],
    },
    ...locatorAction('click'),
    ...locatorAction('fill', { properties: { text: { type: 'string', description: 'Text to enter. Empty string is allowed.' } }, required: ['text'] }),
    ...locatorAction('check'),
    ...locatorAction('uncheck'),
    ...locatorAction('select', { properties: { option: { type: 'string', minLength: 1 } }, required: ['option'] }),
    ...locatorAction('press', { properties: { key: { type: 'string', minLength: 1, examples: ['Enter', 'Tab', 'Escape'] } }, required: ['key'] }),
    ...locatorAction('expectVisible'),
    ...locatorAction('expectHidden'),
    ...locatorAction('expectText', {
      properties: {
        text: { type: 'string' },
        match: { enum: ['contains', 'exact'], default: 'contains' },
      },
      required: ['text'],
    }),
    ...locatorAction('expectValue', { properties: { expected: { type: 'string' } }, required: ['expected'] }),
  ];

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://testigent.ai/schemas/declarative-scenario-v1.json',
    title: 'TestigentAI Declarative UI Scenario',
    description: 'Schema-driven, governed low-code UI scenario executed by Playwright. Use TypeScript for complex control flow or cross-layer orchestration.',
    type: 'object',
    additionalProperties: false,
    properties: {
      schemaVersion: { const: SCENARIO_SCHEMA_VERSION, default: SCENARIO_SCHEMA_VERSION },
      kind: { const: 'ui', default: 'ui' },
      id: {
        type: 'string',
        minLength: 1,
        pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
        description: 'Stable lower-kebab-case scenario identifier used in reporting and @scenario:<id> selection.',
      },
      title: { type: 'string', minLength: 1 },
      description: { type: 'string', minLength: 1 },
      tags: {
        type: 'array',
        default: [],
        uniqueItems: true,
        items: { type: 'string', pattern: '^@[A-Za-z0-9:_-]+$' },
        description: 'Execution/profile tags such as @smoke or @regression. @declarative, @ui, and @lane:ui are injected by the runner spec.',
      },
      steps: {
        type: 'array',
        minItems: 1,
        items: { oneOf: stepBranches },
      },
    },
    required: ['id', 'title', 'steps'],
    examples: [{
      schemaVersion: 1,
      kind: 'ui',
      id: 'login-valid-user',
      title: 'Valid user can sign in',
      tags: ['@smoke'],
      steps: [
        { action: 'goto', url: '/login' },
        { action: 'fill', by: 'label', value: 'Email', text: 'qa@example.com' },
        { action: 'click', by: 'role', role: 'button', name: 'Sign in' },
        { action: 'expectVisible', by: 'text', value: 'Welcome' },
      ],
    }],
    'x-testigent-locator-strategies': [...SUPPORTED_LOCATOR_STRATEGIES],
  };
}

function buildLocatorBranches(): JsonSchema[] {
  const exact = { type: 'boolean', description: 'Use exact text/name matching when supported.' };
  const withValue = (by: string, description: string, supportsExact = true): JsonSchema => ({
    properties: {
      by: { const: by, description },
      value: { type: 'string', minLength: 1 },
      ...(supportsExact ? { exact } : {}),
    },
    required: ['by', 'value'],
  });

  return [
    {
      properties: {
        by: { const: 'role', description: 'Preferred semantic locator using Playwright getByRole().' },
        role: { enum: [...SUPPORTED_ARIA_ROLES] },
        name: { type: 'string', minLength: 1 },
        exact,
      },
      required: ['by', 'role'],
    },
    withValue('label', 'Form control located by associated label.'),
    withValue('text', 'Element located by visible text.'),
    withValue('testId', 'Stable explicit test contract using getByTestId().', false),
    withValue('placeholder', 'Input located by placeholder text.'),
    withValue('altText', 'Element located by alternative text.'),
    withValue('title', 'Element located by title attribute.'),
    withValue('css', 'Advanced fallback CSS selector. Prefer semantic locators.', false),
  ];
}
