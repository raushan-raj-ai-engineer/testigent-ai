import path from 'node:path';

/** Validates a project/application identifier before it is used in filesystem paths. */
export function assertSafeProjectName(project: string): string {
  const normalized = project.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(normalized)) throw new Error(`Unsafe project name '${project}'.`);
  return normalized;
}

/** Resolves one workspace-relative path and rejects traversal or absolute-path escape. */
export function resolveWorkspacePath(root: string, relativePath: string): string {
  if (!relativePath.trim() || path.isAbsolute(relativePath)) throw new Error(`Unsafe workspace path '${relativePath}'.`);
  const workspace = path.resolve(root);
  const absolute = path.resolve(workspace, relativePath);
  const relative = path.relative(workspace, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Workspace path escapes repository root: '${relativePath}'.`);
  return absolute;
}

/** Validates an agent-generated target path and keeps it inside the selected project source/test boundary. */
export function assertAgenticTargetPath(root: string, project: string, targetPath: string): string {
  const safeProject = assertSafeProjectName(project);
  const normalized = targetPath.replaceAll('\\', '/').replace(/^\.\//, '');
  if (!normalized.startsWith(`projects/${safeProject}/`)) throw new Error(`Agentic target must remain inside projects/${safeProject}/.`);
  if (!/\.(?:ts|tsx|js|mjs|cjs|json|ya?ml)$/i.test(normalized)) throw new Error(`Unsupported agentic target file type: '${targetPath}'.`);
  resolveWorkspacePath(root, normalized);
  return normalized;
}
