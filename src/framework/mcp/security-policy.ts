import fs from 'node:fs';
import path from 'node:path';
import { assertSafeProjectName, resolveWorkspacePath } from '../agentic/policy/path-policy.js';

const REQUIREMENT_EXTENSIONS = new Set(['.md', '.json', '.csv', '.xlsx', '.xls']);

/** Resolves a local requirement source while denying traversal, remote URLs and cross-project reads. */
export function resolveMcpRequirementPath(root: string, project: string, requirementFile: string): string {
  const safeProject = assertSafeProjectName(project);
  const normalized = requirementFile.replaceAll('\\', '/').replace(/^\.\//, '');
  if (/^[a-z]+:\/\//i.test(normalized) || /^(?:JIRA|AZURE|GITHUB):/i.test(normalized)) {
    throw new Error('Agentic MCP requirement planning is local-only by default; remote connector sources are not exposed through this MCP boundary.');
  }
  const relative = normalized.startsWith(`projects/${safeProject}/requirements/`)
    ? normalized
    : `projects/${safeProject}/requirements/${normalized}`;
  const absolute = resolveWorkspacePath(root, relative);
  const requirementRoot = path.resolve(root, 'projects', safeProject, 'requirements');
  const relation = path.relative(requirementRoot, absolute);
  if (relation.startsWith('..') || path.isAbsolute(relation)) throw new Error('Requirement source escapes the selected project requirement directory.');
  if (!REQUIREMENT_EXTENSIONS.has(path.extname(absolute).toLowerCase())) throw new Error(`Unsupported MCP requirement source: ${path.extname(absolute) || '<none>'}.`);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw new Error(`Requirement source not found: ${relative}`);
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
