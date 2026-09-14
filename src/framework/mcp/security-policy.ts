import fs from 'node:fs';
import path from 'node:path';
import { assertSafeProjectName, normalizeSafeRelativePath, resolveContainedPath } from '../agentic/policy/path-policy.js';

const REQUIREMENT_EXTENSIONS = new Set(['.md', '.json', '.csv', '.xlsx', '.xls']);

/** Resolves a local requirement source using canonical containment; symlink traversal across projects is denied. */
export function resolveMcpRequirementPath(root: string, project: string, requirementFile: string): string {
  const safeProject = assertSafeProjectName(project);
  const normalized = normalizeSafeRelativePath(requirementFile);
  if (/^[a-z]+:\/\//i.test(normalized) || /^(?:JIRA|AZURE|GITHUB):/i.test(normalized)) {
    throw new Error('Agentic MCP requirement planning is local-only by default; remote connector sources are not exposed through this MCP boundary.');
  }
  const relative = normalized.startsWith(`projects/${safeProject}/requirements/`)
    ? normalized
    : `projects/${safeProject}/requirements/${normalized}`;
  if (!REQUIREMENT_EXTENSIONS.has(path.extname(relative).toLowerCase())) throw new Error(`Unsupported MCP requirement source: ${path.extname(relative) || '<none>'}.`);
  const absolute = resolveContainedPath(root, relative, { mustExist: true, mustBeFile: true });
  const requirementRoot = resolveContainedPath(root, `projects/${safeProject}/requirements`, { mustExist: true });
  const relation = path.relative(requirementRoot, absolute);
  if (relation === '..' || relation.startsWith(`..${path.sep}`) || path.isAbsolute(relation)) throw new Error('Requirement source escapes the selected project requirement directory.');
  if (!fs.statSync(absolute).isFile()) throw new Error(`Requirement source not found: ${relative}`);
  return absolute;
}

/** Applies bounded-string policy to model-controlled MCP arguments before framework code consumes them. */
export function boundedMcpString(value: unknown, field: string, maxChars = 20_000): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`MCP argument '${field}' must be a non-empty string.`);
  if (value.length > maxChars) throw new Error(`MCP argument '${field}' exceeds ${maxChars} characters.`);
  return value.trim();
}

/** Validates a model-controlled string array and enforces a deterministic item/count boundary. */
export function boundedMcpStringArray(value: unknown, field: string, maxItems = 100, maxChars = 1_000): string[] {
  if (!Array.isArray(value)) throw new Error(`MCP argument '${field}' must be an array.`);
  if (value.length > maxItems) throw new Error(`MCP argument '${field}' exceeds ${maxItems} items.`);
  return value.map((item, index) => boundedMcpString(item, `${field}[${index}]`, maxChars));
}

/** Enforces additionalProperties:false at runtime instead of relying on advertised MCP JSON schema alone. */
export function assertExactObjectKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const allowedSet = new Set(allowed);
  const extras = Object.keys(value).filter(key => !allowedSet.has(key));
  if (extras.length) throw new Error(`${label} contains unsupported field(s): ${extras.sort().join(', ')}.`);
}
