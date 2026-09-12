import fs from 'node:fs';
import path from 'node:path';
import { ApplicationRegistry } from '../config/application.registry';
import { WorkspaceContext } from '../config/workspace.context';

export interface MultiProjectGroupConfig {
  description?: string;
  projects: string[];
  environments?: Record<string, string>;
}

export interface MultiProjectSelection {
  all?: boolean;
  apps?: string[];
  group?: string;
  environment?: string;
  environmentMap?: Record<string, string>;
}

export interface MultiProjectTarget {
  application: string;
  environment: string;
}

/** Resolves a dynamic all-project, explicit-project, or named-group selection into validated project/environment targets. */
export function resolveMultiProjectTargets(selection: MultiProjectSelection, root = process.cwd()): MultiProjectTarget[] {
  const registered = ApplicationRegistry.listProjects(root);
  if (!registered.length) throw new Error('No registered projects found under projects/<project>/config.');

  const apps = selection.apps ?? [];
  const selectors = Number(selection.all === true) + Number(apps.length > 0) + Number(Boolean(selection.group));
  if (selectors !== 1) {
    throw new Error('Choose exactly one project selector: all, apps, or group.');
  }

  let applications: string[];
  let groupEnvironments: Record<string, string> = {};
  if (selection.all) {
    applications = registered;
  } else if (apps.length) {
    applications = apps;
  } else {
    const groups = readMultiProjectGroups(root);
    const group = groups[selection.group!];
    if (!group) {
      const available = Object.keys(groups).sort();
      throw new Error(`Unknown project group '${selection.group}'. Available groups: ${available.join(', ') || '(none)'}.`);
    }
    applications = group.projects;
    groupEnvironments = group.environments ?? {};
  }

  applications = [...new Set(applications.map(value => value.trim()).filter(Boolean))];
  const unknown = applications.filter(application => !registered.includes(application));
  if (unknown.length) throw new Error(`Unknown/unregistered project(s): ${unknown.join(', ')}. Registered: ${registered.join(', ')}.`);

  const environmentMap = selection.environmentMap ?? {};
  return applications.map(application => {
    const environment = environmentMap[application]
      ?? selection.environment
      ?? groupEnvironments[application]
      ?? inferProjectEnvironment(application, root);
    ApplicationRegistry.projectConfig(application, environment, root);
    return { application, environment };
  });
}

/** Reads optional customer/portfolio project groups from config/project-groups.json. */
export function readMultiProjectGroups(root = process.cwd()): Record<string, MultiProjectGroupConfig> {
  const file = path.resolve(root, 'config', 'project-groups.json');
  if (!fs.existsSync(file)) return {};
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { groups?: Record<string, MultiProjectGroupConfig> };
  const groups = parsed.groups ?? {};
  for (const [name, group] of Object.entries(groups)) {
    if (!Array.isArray(group.projects) || !group.projects.length) throw new Error(`Project group '${name}' must contain at least one project.`);
    const duplicates = group.projects.filter((project, index) => group.projects.indexOf(project) !== index);
    if (duplicates.length) throw new Error(`Project group '${name}' contains duplicate project(s): ${[...new Set(duplicates)].join(', ')}.`);
  }
  return groups;
}

/** Parses CLI project:environment mappings such as portal:qa,payments:uat. */
export function parseProjectEnvironmentMap(value: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of splitCsv(value)) {
    const separator = entry.indexOf(':');
    if (separator < 1 || separator === entry.length - 1) throw new Error(`Invalid environment-map entry '${entry}'. Expected project:environment.`);
    const application = entry.slice(0, separator).trim();
    const environment = entry.slice(separator + 1).trim();
    if (result[application]) throw new Error(`Duplicate environment mapping for project '${application}'.`);
    result[application] = environment;
  }
  return result;
}

/** Splits a comma-separated project selection while removing blanks and preserving user order. */
export function splitProjectList(value: string): string[] {
  return splitCsv(value);
}

function inferProjectEnvironment(application: string, root: string): string {
  const environments = WorkspaceContext.listEnvironments(application, root);
  if (environments.length === 1) return environments[0]!;
  throw new Error(
    `Environment is ambiguous for '${application}'. Available: ${environments.join(', ') || '(none)'}. ` +
    `Use --env=<environment>, --env-map=${application}:<environment>, or configure the group environment mapping.`,
  );
}

function splitCsv(value: string): string[] {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}
