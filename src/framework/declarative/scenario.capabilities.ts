import { SUPPORTED_DECLARATIVE_ACTIONS, SUPPORTED_LOCATOR_STRATEGIES } from './scenario.constants';

export interface DeclarativeCapability {
  name: string;
  category: 'navigation' | 'interaction' | 'assertion';
  purpose: string;
  example: string;
}

/** Human-readable action catalog shown by scenario:help and used for drift checks. */
export const DECLARATIVE_CAPABILITIES: readonly DeclarativeCapability[] = [
  { name: 'goto', category: 'navigation', purpose: 'Navigate within the configured application.', example: 'url: /orders' },
  { name: 'click', category: 'interaction', purpose: 'Click a uniquely identified element.', example: 'by: role, role: button, name: Save' },
  { name: 'fill', category: 'interaction', purpose: 'Enter text into an input.', example: 'by: label, value: Email, text: qa@example.com' },
  { name: 'check', category: 'interaction', purpose: 'Check a checkbox or radio control.', example: 'by: label, value: Accept terms' },
  { name: 'uncheck', category: 'interaction', purpose: 'Clear a checkbox.', example: 'by: label, value: Subscribe' },
  { name: 'select', category: 'interaction', purpose: 'Select one option from a native select.', example: 'by: label, value: Country, option: India' },
  { name: 'press', category: 'interaction', purpose: 'Send a keyboard key to an element.', example: 'by: placeholder, value: Search, key: Enter' },
  { name: 'expectVisible', category: 'assertion', purpose: 'Assert an element is visible.', example: 'by: text, value: Success' },
  { name: 'expectHidden', category: 'assertion', purpose: 'Assert an element is hidden.', example: 'by: text, value: Loading' },
  { name: 'expectText', category: 'assertion', purpose: 'Assert element text contains or exactly matches expected text.', example: 'by: testId, value: status, text: Approved' },
  { name: 'expectValue', category: 'assertion', purpose: 'Assert a form control value.', example: 'by: label, value: Email, expected: qa@example.com' },
] as const;

/** Scenarios deliberately routed to code-first TypeScript instead of expanding the DSL unsafely. */
export const TYPESCRIPT_REQUIRED_GUIDANCE = [
  'conditions, loops, branching, retries with custom business logic',
  'UI + API + database orchestration in one scenario',
  'multi-tab/window, popup, iframe, Shadow DOM, file upload/download, drag-drop, or custom browser events not explicitly supported by the DSL',
  'network interception, mocking, route fulfillment, WebSocket or advanced request control',
  'complex authentication setup, token exchange, cryptography, or secret transformation',
  'dynamic calculations, custom data transformations, or reusable programming abstractions',
  'AI/LLM evaluation, agent trajectory checks, custom metrics, or model-provider logic',
  'performance/load workflows beyond the declarative UI assertion layer',
] as const;

/** Fails fast when the human capability catalog drifts from executable action constants. */
export function assertCapabilityCatalogMatchesSchema(): void {
  const catalogActions = new Set(DECLARATIVE_CAPABILITIES.map(item => item.name));
  const missing = SUPPORTED_DECLARATIVE_ACTIONS.filter(action => !catalogActions.has(action));
  const supported = new Set<string>(SUPPORTED_DECLARATIVE_ACTIONS);
  const extra = [...catalogActions].filter(action => !supported.has(action));
  if (missing.length || extra.length) {
    throw new Error(`Declarative capability catalog drift. Missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}.`);
  }
  if (!SUPPORTED_LOCATOR_STRATEGIES.length) throw new Error('Declarative locator strategy catalog is empty.');
}
