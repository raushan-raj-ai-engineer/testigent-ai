import { WorkspaceContext } from './workspace.context';

/**
 * Resolves only the application namespace needed for local artifacts (healing cache/audit/history).
 * Unlike full RuntimeConfig it deliberately does not require an environment, which keeps framework
 * contract tests and offline maintenance tools independent from a real project environment file.
 */
export function resolveApplicationScope(
  explicit?: string,
  root = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = explicit?.trim() || env.APP?.trim() || WorkspaceContext.read(root)?.application;
  if (value) return validate(value);

  const projects = WorkspaceContext.listProjects(root);
  if (projects.length === 1) return projects[0]!;
  throw new Error(
    `Application scope is required for project-scoped artifacts. Select a project with qa:use or set APP. ` +
    `Available projects: ${projects.join(', ') || '(none)'}`,
  );
}

function validate(value: string): string {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(value)) throw new Error(`Invalid application scope '${value}'.`);
  return value;
}
