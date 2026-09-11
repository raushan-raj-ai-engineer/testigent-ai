import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { declarativeScenarioSchema, type DeclarativeScenario } from './scenario.schema';
import { SUPPORTED_DECLARATIVE_ACTIONS } from './scenario.constants';

/** Loads and validates one governed JSON/YAML scenario without executing arbitrary code. */
export function loadDeclarativeScenario(filePath: string): DeclarativeScenario {
  const absolute = path.resolve(filePath);
  const text = fs.readFileSync(absolute, 'utf8');
  const extension = path.extname(absolute).toLowerCase();
  let raw: unknown;

  if (extension === '.yaml' || extension === '.yml') {
    const document = YAML.parseDocument(text, { uniqueKeys: true });
    if (document.errors.length) {
      throw new Error(`${absolute}: invalid YAML: ${document.errors.map(error => error.message).join('; ')}`);
    }
    raw = document.toJS({ maxAliasCount: 20 });
  } else if (extension === '.json') {
    raw = JSON.parse(text);
  } else {
    throw new Error(`${absolute}: supported scenario extensions are .yaml, .yml, and .json.`);
  }

  return validateScenario(raw, absolute);
}

/** Validates the declarative DSL and returns a normalized scenario with schema defaults applied. */
export function validateScenario(raw: unknown, source = 'scenario'): DeclarativeScenario {
  assertAllowedActions(raw, source);
  const result = declarativeScenarioSchema.safeParse(raw);
  if (!result.success) {
    const details = result.error.issues.map(issue => {
      const pathLabel = issue.path.length ? issue.path.join('.') : '<root>';
      return `${pathLabel}: ${issue.message}`;
    });
    throw new Error(`${source}: declarative scenario is invalid\n- ${details.join('\n- ')}\nRun "npm run scenario:help" for supported actions and authoring guidance.`);
  }
  return result.data;
}


/**
 * Rejects unknown executable actions before union-schema parsing so authors get a
 * deterministic governance error instead of Zod's generic "Invalid input".
 */
function assertAllowedActions(raw: unknown, source: string): void {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;

  const steps = (raw as { steps?: unknown }).steps;
  if (!Array.isArray(steps)) return;

  const allowed = new Set<string>(SUPPORTED_DECLARATIVE_ACTIONS);
  for (const [index, step] of steps.entries()) {
    if (!step || typeof step !== 'object' || Array.isArray(step)) continue;
    const action = (step as { action?: unknown }).action;
    if (typeof action === 'string' && !allowed.has(action)) {
      throw new Error(
        `${source}: step ${index + 1} action '${action}' is not allowed. ` +
        `Allowed actions: ${SUPPORTED_DECLARATIVE_ACTIONS.join(', ')}. ` +
        'Run "npm run scenario:help" for authoring guidance.',
      );
    }
  }
}
