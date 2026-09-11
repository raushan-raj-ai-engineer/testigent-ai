import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { DeclarativeScenario } from './scenario.types';

/** Loads a constrained JSON/YAML scenario specification for low-code/manual-tester authoring. */
export function loadDeclarativeScenario(filePath: string): DeclarativeScenario {
  const absolute = path.resolve(filePath);
  const text = fs.readFileSync(absolute, 'utf8');
  const extension = path.extname(absolute).toLowerCase();
  const raw = extension === '.yaml' || extension === '.yml' ? YAML.parse(text) : JSON.parse(text);
  return validateScenario(raw, absolute);
}

/** Validates the declarative DSL without allowing arbitrary JavaScript execution. */
export function validateScenario(raw: unknown, source = 'scenario'): DeclarativeScenario {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${source}: scenario must be an object.`);
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== 'string' || !value.id.trim()) throw new Error(`${source}: id is required.`);
  if (typeof value.title !== 'string' || !value.title.trim()) throw new Error(`${source}: title is required.`);
  if (!Array.isArray(value.steps) || !value.steps.length) throw new Error(`${source}: steps must be a non-empty array.`);
  const allowed = new Set(['goto', 'click', 'fill', 'check', 'select', 'expectVisible', 'expectText']);
  for (const [index, step] of value.steps.entries()) {
    if (!step || typeof step !== 'object' || Array.isArray(step)) throw new Error(`${source}: step ${index + 1} must be an object.`);
    const action = String((step as Record<string, unknown>).action ?? '');
    if (!allowed.has(action)) throw new Error(`${source}: step ${index + 1} action '${action}' is not allowed.`);
  }
  return raw as DeclarativeScenario;
}
