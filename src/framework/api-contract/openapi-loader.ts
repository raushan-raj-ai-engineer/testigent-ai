import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { OpenApiDocument, OpenApiSchema, OpenApiSchemaLike } from './openapi.types.js';

/** Loads and validates one local OpenAPI 3 JSON/YAML document. */
export function loadOpenApiDocument(file: string): OpenApiDocument {
  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) throw new Error(`OpenAPI document does not exist: ${resolved}`);
  const text = fs.readFileSync(resolved, 'utf8');
  const parsed = path.extname(resolved).toLowerCase() === '.json' ? JSON.parse(text) : YAML.parse(text);
  validateDocument(parsed, resolved);
  return parsed as OpenApiDocument;
}

/**
 * Resolves bounded local component schema references. In OpenAPI 3.1, $ref siblings are conjunctive,
 * so they are represented as allOf instead of being spread/overwritten. OpenAPI 3.0 siblings fail closed.
 */
export function resolveSchema(document: OpenApiDocument, schema: OpenApiSchemaLike, seen = new Set<string>()): OpenApiSchemaLike {
  if (typeof schema === 'boolean') return schema;
  if (!schema.$ref) return schema;
  const prefix = '#/components/schemas/';
  if (!schema.$ref.startsWith(prefix)) throw new Error(`Unsupported external OpenAPI $ref '${schema.$ref}'.`);
  if (seen.has(schema.$ref)) throw new Error(`Circular OpenAPI schema reference '${schema.$ref}'.`);
  const nextSeen = new Set(seen); nextSeen.add(schema.$ref);
  const name = decodeRefToken(schema.$ref.slice(prefix.length));
  const target = document.components?.schemas?.[name];
  if (target === undefined) throw new Error(`Unresolved OpenAPI schema reference '${schema.$ref}'.`);
  const resolved = typeof target === 'object' && target !== null && '$ref' in target ? resolveSchema(document, target, nextSeen) : target;
  const siblings = Object.fromEntries(Object.entries(schema).filter(([key]) => key !== '$ref')) as OpenApiSchema;
  if (Object.keys(siblings).length === 0) return resolved;
  if (/^3\.0\./.test(document.openapi)) throw new Error(`Unsupported OpenAPI 3.0 schema: $ref siblings cannot be validated safely for '${schema.$ref}'.`);
  return { allOf: [resolved, siblings] };
}

function decodeRefToken(value: string): string {
  return decodeURIComponent(value).replace(/~1/g, '/').replace(/~0/g, '~');
}

function validateDocument(value: unknown, file: string): void {
  if (!value || typeof value !== 'object') throw new Error(`OpenAPI document '${file}' must be an object.`);
  const candidate = value as Partial<OpenApiDocument>;
  if (typeof candidate.openapi !== 'string' || !/^3\.(?:0|1)\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(candidate.openapi)) throw new Error(`OpenAPI document '${file}' must use a supported OpenAPI 3.0.x or 3.1.x dialect.`);
  if (!candidate.paths || typeof candidate.paths !== 'object') throw new Error(`OpenAPI document '${file}' is missing paths.`);
}
