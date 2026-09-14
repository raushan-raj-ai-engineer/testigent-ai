import fs from 'node:fs';
import path from 'node:path';

const AGENTIC_PROJECT_DIRS = new Set(['src', 'tests', 'fixtures', 'data']);

/** Validates a project/application identifier before it is used in filesystem paths. */
export function assertSafeProjectName(project: string): string {
  const normalized = project.trim();
  if (normalized === '.' || normalized === '..' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(normalized)) throw new Error(`Unsafe project name '${project}'.`);
  return normalized;
}

/** Normalizes one repository-relative path and rejects every traversal/absolute-path form before filesystem access. */
export function normalizeSafeRelativePath(relativePath: string): string {
  const raw = String(relativePath ?? '').trim();
  if (!raw || path.isAbsolute(raw) || /^[A-Za-z]:[\\/]/.test(raw) || /^\\\\/.test(raw)) throw new Error(`Unsafe workspace path '${relativePath}'.`);
  const normalized = raw.replaceAll('\\', '/').replace(/^\.\//, '');
  const segments = normalized.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) throw new Error(`Unsafe workspace path '${relativePath}'.`);
  return segments.join('/');
}

/** Resolves a path beneath a root and validates symlink/canonical containment for existing targets and future-target ancestors. */
export function resolveContainedPath(root: string, relativePath: string, options: { mustExist?: boolean; mustBeFile?: boolean } = {}): string {
  const normalized = normalizeSafeRelativePath(relativePath);
  const lexicalRoot = path.resolve(root);
  const canonicalRoot = fs.existsSync(lexicalRoot) ? fs.realpathSync.native(lexicalRoot) : lexicalRoot;
  const absolute = path.resolve(lexicalRoot, normalized);
  assertInside(lexicalRoot, absolute, relativePath);

  if (options.mustExist && !fs.existsSync(absolute)) throw new Error(`Workspace path does not exist: '${relativePath}'.`);
  if (fs.existsSync(absolute)) {
    const canonical = fs.realpathSync.native(absolute);
    assertInside(canonicalRoot, canonical, relativePath);
    if (options.mustBeFile && !fs.statSync(canonical).isFile()) throw new Error(`Workspace path is not a file: '${relativePath}'.`);
    return canonical;
  }

  let ancestor = path.dirname(absolute);
  while (!fs.existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor) throw new Error(`Unable to resolve safe ancestor for '${relativePath}'.`);
    ancestor = parent;
  }
  const canonicalAncestor = fs.realpathSync.native(ancestor);
  assertInside(canonicalRoot, canonicalAncestor, relativePath);
  return absolute;
}

/** Resolves one workspace-relative path and rejects lexical, symlink and future-target ancestor escape. */
export function resolveWorkspacePath(root: string, relativePath: string): string {
  return resolveContainedPath(root, relativePath);
}

/**
 * Resolves a path inside one selected project. Project, boundary-directory and existing descendant symlinks/junctions
 * are rejected so one project can never alias another project's files while still remaining inside the repository.
 */
export function resolveProjectScopedPath(
  root: string,
  project: string,
  projectRelativePath: string,
  options: { mustExist?: boolean; mustBeFile?: boolean } = {},
): string {
  const safeProject = assertSafeProjectName(project);
  const normalized = normalizeSafeRelativePath(projectRelativePath);
  const workspaceRoot = path.resolve(root);
  const projectsRoot = path.join(workspaceRoot, 'projects');
  const projectRoot = path.join(projectsRoot, safeProject);

  assertExistingDirectoryBoundary(workspaceRoot, 'workspace root');
  assertExistingDirectoryBoundary(projectsRoot, 'projects root');
  assertExistingDirectoryBoundary(projectRoot, `selected project '${safeProject}'`);

  const canonicalWorkspace = fs.realpathSync.native(workspaceRoot);
  const canonicalProjects = fs.realpathSync.native(projectsRoot);
  const canonicalProject = fs.realpathSync.native(projectRoot);
  assertInside(canonicalWorkspace, canonicalProjects, 'projects');
  assertInside(canonicalProjects, canonicalProject, `projects/${safeProject}`);

  const absolute = path.resolve(projectRoot, normalized);
  assertInside(projectRoot, absolute, `projects/${safeProject}/${normalized}`);
  assertNoSymlinkComponents(projectRoot, absolute, `projects/${safeProject}/${normalized}`);

  if (options.mustExist && !fs.existsSync(absolute)) throw new Error(`Project path does not exist: 'projects/${safeProject}/${normalized}'.`);
  if (fs.existsSync(absolute)) {
    const canonical = fs.realpathSync.native(absolute);
    assertInside(canonicalProject, canonical, `projects/${safeProject}/${normalized}`);
    if (options.mustBeFile && !fs.statSync(canonical).isFile()) throw new Error(`Project path is not a file: 'projects/${safeProject}/${normalized}'.`);
    return canonical;
  }

  let ancestor = path.dirname(absolute);
  while (!fs.existsSync(ancestor)) {
    const parent = path.dirname(ancestor);
    if (parent === ancestor || !isInsideOrEqual(projectRoot, parent)) throw new Error(`Unable to resolve safe project ancestor for 'projects/${safeProject}/${normalized}'.`);
    ancestor = parent;
  }
  assertNoSymlinkComponents(projectRoot, ancestor, `projects/${safeProject}/${normalized}`);
  const canonicalAncestor = fs.realpathSync.native(ancestor);
  assertInside(canonicalProject, canonicalAncestor, `projects/${safeProject}/${normalized}`);
  return absolute;
}

/** Validates an agent-generated target and returns a canonical-safe project-relative path. */
export function assertAgenticTargetPath(root: string, project: string, targetPath: string): string {
  const safeProject = assertSafeProjectName(project);
  const normalized = normalizeSafeRelativePath(targetPath);
  const prefix = `projects/${safeProject}/`;
  if (!normalized.startsWith(prefix)) throw new Error(`Agentic target must remain inside projects/${safeProject}/.`);
  const projectRelative = normalized.slice(prefix.length);
  const firstSegment = projectRelative.split('/')[0];
  if (!AGENTIC_PROJECT_DIRS.has(firstSegment)) throw new Error(`Agentic target must remain inside ${[...AGENTIC_PROJECT_DIRS].join(', ')} for projects/${safeProject}.`);
  if (!/\.(?:ts|tsx|js|mjs|cjs|json|ya?ml)$/i.test(normalized)) throw new Error(`Unsupported agentic target file type: '${targetPath}'.`);
  resolveProjectScopedPath(root, safeProject, projectRelative);
  return normalized;
}

/** Revalidates any projects/<project>/... path at a mutation/promotion boundary. */
export function resolveProjectMutationPath(root: string, workspaceRelativePath: string): string {
  const normalized = normalizeSafeRelativePath(workspaceRelativePath);
  const parts = normalized.split('/');
  if (parts[0] !== 'projects' || parts.length < 3) return resolveWorkspacePath(root, normalized);
  const project = assertSafeProjectName(parts[1]!);
  return resolveProjectScopedPath(root, project, parts.slice(2).join('/'));
}

function assertExistingDirectoryBoundary(candidate: string, label: string): void {
  if (!fs.existsSync(candidate)) throw new Error(`Project boundary does not exist: ${label}.`);
  const stat = fs.lstatSync(candidate);
  if (stat.isSymbolicLink()) throw new Error(`Project boundary cannot be a symlink/junction: ${label}.`);
  if (!stat.isDirectory()) throw new Error(`Project boundary is not a directory: ${label}.`);
}

function assertNoSymlinkComponents(projectRoot: string, candidate: string, source: string): void {
  const relative = path.relative(projectRoot, candidate);
  if (relative === '') return;
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error(`Project path escapes selected project boundary: '${source}'.`);
  let cursor = projectRoot;
  for (const segment of relative.split(path.sep)) {
    cursor = path.join(cursor, segment);
    if (!fs.existsSync(cursor)) break;
    if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error(`Project path crosses a symlink/junction boundary: '${source}'.`);
  }
}

function isInsideOrEqual(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!(relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)));
}

function assertInside(root: string, candidate: string, source: string): void {
  if (!isInsideOrEqual(root, candidate)) throw new Error(`Workspace path escapes canonical boundary: '${source}'.`);
}
