import { z } from 'zod';

import {
  SCENARIO_SCHEMA_VERSION,
  SUPPORTED_ARIA_ROLES,
  SUPPORTED_DECLARATIVE_ACTIONS,
  SUPPORTED_LOCATOR_STRATEGIES,
} from './scenario.constants';

export {
  SCENARIO_SCHEMA_VERSION,
  SUPPORTED_ARIA_ROLES,
  SUPPORTED_DECLARATIVE_ACTIONS,
  SUPPORTED_LOCATOR_STRATEGIES,
} from './scenario.constants';

const nonEmptyText = z.string().trim().min(1);
const exact = z.boolean().optional().meta({ description: 'Use an exact text/name match when supported.' });

const locatorVariants = [
  z.object({ by: z.literal('role'), role: z.enum(SUPPORTED_ARIA_ROLES), name: nonEmptyText.optional(), exact }).strict()
    .meta({ description: 'Preferred semantic locator. Uses Playwright getByRole().' }),
  z.object({ by: z.literal('label'), value: nonEmptyText, exact }).strict()
    .meta({ description: 'Form control located by its associated label.' }),
  z.object({ by: z.literal('text'), value: nonEmptyText, exact }).strict()
    .meta({ description: 'Element located by visible text.' }),
  z.object({ by: z.literal('testId'), value: nonEmptyText }).strict()
    .meta({ description: 'Stable test contract using Playwright getByTestId().' }),
  z.object({ by: z.literal('placeholder'), value: nonEmptyText, exact }).strict()
    .meta({ description: 'Input located by placeholder text.' }),
  z.object({ by: z.literal('altText'), value: nonEmptyText, exact }).strict()
    .meta({ description: 'Element located by accessible alternative text.' }),
  z.object({ by: z.literal('title'), value: nonEmptyText, exact }).strict()
    .meta({ description: 'Element located by title attribute.' }),
  z.object({ by: z.literal('css'), value: nonEmptyText }).strict()
    .meta({ description: 'Advanced fallback CSS selector. Prefer role/label/text/testId when possible.' }),
] as const;

/** Runtime schema for an allow-listed Playwright locator. */
export const declarativeLocatorSchema = z.union(locatorVariants);

function locatorSteps<const A extends string, T extends z.ZodRawShape>(action: A, extra: T) {
  return locatorVariants.map(locator => locator.extend({ action: z.literal(action), ...extra }).strict());
}

const gotoStep = z.object({
  action: z.literal('goto'),
  url: nonEmptyText.regex(/^(?:https?:\/\/|\/|\.\/)/, 'url must start with /, ./, http://, or https://').meta({
    description: 'Application-relative path (recommended) or an http(s) URL. External origins are blocked by default.',
    examples: ['/', '/orders', 'https://example.test/app'],
  }),
}).strict();

const clickSteps = locatorSteps('click', {});
const fillSteps = locatorSteps('fill', { text: z.string().meta({ description: 'Text to enter. Empty string is allowed.' }) });
const checkSteps = locatorSteps('check', {});
const uncheckSteps = locatorSteps('uncheck', {});
const selectSteps = locatorSteps('select', { option: nonEmptyText.meta({ description: 'Option value or label passed to selectOption().' }) });
const pressSteps = locatorSteps('press', { key: nonEmptyText.meta({ description: 'Playwright keyboard key, for example Enter, Tab, Escape.' }) });
const visibleSteps = locatorSteps('expectVisible', {});
const hiddenSteps = locatorSteps('expectHidden', {});
const textSteps = locatorSteps('expectText', {
  text: z.string(),
  match: z.enum(['contains', 'exact']).default('contains').optional(),
});
const valueSteps = locatorSteps('expectValue', { expected: z.string() });

/** Runtime schema for one executable declarative step. */
export const declarativeStepSchema = z.union([
  gotoStep,
  ...clickSteps,
  ...fillSteps,
  ...checkSteps,
  ...uncheckSteps,
  ...selectSteps,
  ...pressSteps,
  ...visibleSteps,
  ...hiddenSteps,
  ...textSteps,
  ...valueSteps,
]);

/** Authoritative runtime schema for a complete declarative UI scenario. */
export const declarativeScenarioSchema = z.object({
  schemaVersion: z.literal(SCENARIO_SCHEMA_VERSION).default(SCENARIO_SCHEMA_VERSION),
  kind: z.literal('ui').default('ui'),
  id: z.string().trim().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'id must use lower-kebab-case'),
  title: nonEmptyText,
  description: z.string().trim().min(1).optional(),
  tags: z.array(z.string().regex(/^@[A-Za-z0-9:_-]+$/, 'tags must start with @')).refine(tags => new Set(tags).size === tags.length, 'tags must be unique').default([]),
  steps: z.array(declarativeStepSchema).min(1),
}).strict().meta({
  id: 'https://testigent.ai/schemas/declarative-scenario-v1.json',
  title: 'TestigentAI Declarative UI Scenario',
  description: 'Governed low-code UI scenario executed by Playwright. Use TypeScript for complex control flow or cross-layer orchestration.',
});

export type DeclarativeScenario = z.infer<typeof declarativeScenarioSchema>;
export type DeclarativeStep = z.infer<typeof declarativeStepSchema>;
export type DeclarativeLocator = z.infer<typeof declarativeLocatorSchema>;
export type LocatorStrategy = DeclarativeLocator['by'];
