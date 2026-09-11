/** Version of the governed declarative scenario contract. */
export const SCENARIO_SCHEMA_VERSION = 1 as const;

/** Allow-listed actions executable by the low-code runner. */
export const SUPPORTED_DECLARATIVE_ACTIONS = [
  'goto',
  'click',
  'fill',
  'check',
  'uncheck',
  'select',
  'press',
  'expectVisible',
  'expectHidden',
  'expectText',
  'expectValue',
] as const;

/** Locator strategies exposed to low-code authors. */
export const SUPPORTED_LOCATOR_STRATEGIES = [
  'role',
  'label',
  'text',
  'testId',
  'placeholder',
  'altText',
  'title',
  'css',
] as const;

/** Common ARIA roles intentionally exposed by the declarative DSL. */
export const SUPPORTED_ARIA_ROLES = [
  'alert',
  'button',
  'checkbox',
  'combobox',
  'dialog',
  'heading',
  'link',
  'listbox',
  'menuitem',
  'option',
  'radio',
  'tab',
  'textbox',
] as const;
