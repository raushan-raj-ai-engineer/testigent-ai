import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { OpenApiDocument, OpenApiSchema } from './openapi.types.js';

/** Loads and validates a local OpenAPI 3.x JSON or YAML document. */
export function loadOpenApiDocument(file: string): OpenApiDocument {
  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) throw new Error(`OpenAPI document does not exist: ${resolved}`);
  const text = fs.readFileSync(resolved, 'utf8');
  const parsed = path.extname(resolved).toLowerCase() === '.json' ? JSON.parse(text) : YAML.parse(text);
  validateDocument(parsed, resolved);
  return parsed as OpenApiDocument;
}

/** Resolves supported local component schema references and fails closed on missing, external, or circular references. */
export function resolveSchema(document: OpenApiDocument, schema: OpenApiSchema, seen = new Set<string>()): OpenApiSchema {
  if (!schema.$ref) return schema;
  const prefix = '#/components/schemas/';
  if (!schema.$ref.startsWith(prefix)) throw new Error(`Unsupported external OpenAPI $ref '${schema.$ref}'.`);
  if (seen.has(schema.$ref)) throw new Error(`Circular OpenAPI schema reference '${schema.$ref}'.`);
  seen.add(schema.$ref);
  const name = decodeURIComponent(schema.$ref.slice(prefix.length));
  const resolved = document.components?.schemas?.[name];
  if (!resolved) throw new Error(`Unresolved OpenAPI schema reference '${schema.$ref}'.`);
  return resolved.$ref ? resolveSchema(document, resolved, seen) : resolved;
}

function validateDocument(value: unknown, file: string): void {
  if (!value || typeof value !== 'object') throw new Error(`OpenAPI document '${file}' must be an object.`);
  const candidate = value as Partial<OpenApiDocument>;
  if (typeof candidate.openapi !== 'string' || !/^3\./.test(candidate.openapi)) throw new Error(`OpenAPI document '${file}' must use OpenAPI 3.x.`);
  if (!candidate.paths || typeof candidate.paths !== 'object') throw new Error(`OpenAPI document '${file}' is missing paths.`);
}
