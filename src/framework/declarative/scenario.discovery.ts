import fs from 'node:fs';
import path from 'node:path';
import { loadDeclarativeScenario } from './scenario.loader';
import type { DeclarativeScenario } from './scenario.schema';
import { WorkspaceContext } from '../core/config/workspace.context';

export interface DiscoveredScenario {
  filePath: string;
  scenario: DeclarativeScenario;
}

/** Recursively discovers scenario files for one project, optionally narrowed by SCENARIO_FILE. */
export function discoverDeclarativeScenarios(application = WorkspaceContext.resolve().application): DiscoveredScenario[] {
  const explicit = process.env.SCENARIO_FILE?.trim();
  const files = explicit
    ? [path.resolve(explicit)]
    : discoverFiles(path.resolve('projects', application, 'data', 'scenarios'));

  const discovered = files.map(filePath => ({ filePath, scenario: loadDeclarativeScenario(filePath) }));
  assertUniqueScenarioIds(discovered);
  return discovered;
}

/** Rejects duplicate IDs so reports, grep filters, and CI selection remain deterministic. */
export function assertUniqueScenarioIds(discovered: readonly DiscoveredScenario[]): void {
  const seen = new Map<string, string>();
  for (const item of discovered) {
    const previous = seen.get(item.scenario.id);
    if (previous) throw new Error(`Duplicate declarative scenario id '${item.scenario.id}' in ${previous} and ${item.filePath}.`);
    seen.set(item.scenario.id, item.filePath);
  }
}

function discoverFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const output: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (/\.(?:ya?ml|json)$/i.test(entry.name)) output.push(target);
    }
  };
  visit(root);
  return output.sort();
}
