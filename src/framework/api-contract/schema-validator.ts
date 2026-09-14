import { resolveSchema } from './openapi-loader.js';
import type { OpenApiDocument, OpenApiSchema, SchemaViolation } from './openapi.types.js';

/** Deterministic OpenAPI 3 schema validation for the common contract subset used by service tests. */
export function validateSchemaValue(document: OpenApiDocument, schema: OpenApiSchema, value: unknown, rootPath = '$'): SchemaViolation[] {
  const resolved = resolveSchema(document, schema);
  if (value === null) {
    return resolved.nullable || resolved.type === 'null' ? [] : [{ path: rootPath, rule: 'nullable', message: 'Value is null but schema is not nullable.' }];
  }
  if (resolved.allOf?.length) return resolved.allOf.flatMap(item => validateSchemaValue(document, item, value, rootPath));
  if (resolved.oneOf?.length) {
    const passing = resolved.oneOf.map(item => validateSchemaValue(document, item, value, rootPath)).filter(items => items.length === 0).length;
    return passing === 1 ? [] : [{ path: rootPath, rule: 'oneOf', message: `Expected exactly one schema to match; matched ${passing}.` }];
  }
  if (resolved.anyOf?.length) {
    const passing = resolved.anyOf.some(item => validateSchemaValue(document, item, value, rootPath).length === 0);
    return passing ? [] : [{ path: rootPath, rule: 'anyOf', message: 'Value did not match any allowed schema.' }];
  }
  const violations: SchemaViolation[] = [];
  if (resolved.enum && !resolved.enum.some(item => deepEqual(item, value))) violations.push({ path: rootPath, rule: 'enum', message: `Value is not in the allowed enum.` });
  if (resolved.type && !matchesType(resolved.type, value)) {
    violations.push({ path: rootPath, rule: 'type', message: `Expected ${resolved.type}; received ${runtimeType(value)}.` });
    return violations;
  }
  if ((resolved.type === 'object' || resolved.properties || resolved.required) && isObject(value)) {
    for (const required of resolved.required ?? []) {
      if (!(required in value)) violations.push({ path: `${rootPath}.${required}`, rule: 'required', message: 'Required property is missing.' });
    }
    for (const [key, child] of Object.entries(resolved.properties ?? {})) {
      if (key in value) violations.push(...validateSchemaValue(document, child, value[key], `${rootPath}.${key}`));
    }
    if (resolved.additionalProperties === false && resolved.properties) {
      for (const key of Object.keys(value)) if (!(key in resolved.properties)) violations.push({ path: `${rootPath}.${key}`, rule: 'additionalProperties', message: 'Additional property is not allowed.' });
    } else if (resolved.additionalProperties && typeof resolved.additionalProperties === 'object') {
      for (const key of Object.keys(value)) if (!resolved.properties || !(key in resolved.properties)) violations.push(...validateSchemaValue(document, resolved.additionalProperties, value[key], `${rootPath}.${key}`));
    }
  }
  if ((resolved.type === 'array' || resolved.items) && Array.isArray(value) && resolved.items) {
    value.forEach((item, index) => violations.push(...validateSchemaValue(document, resolved.items!, item, `${rootPath}[${index}]`)));
  }
  return violations;
}

function matchesType(type: OpenApiSchema['type'], value: unknown): boolean {
  switch (type) {
    case 'object': return isObject(value);
    case 'array': return Array.isArray(value);
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'integer': return typeof value === 'number' && Number.isInteger(value);
    case 'boolean': return typeof value === 'boolean';
    case 'null': return value === null;
    default: return true;
  }
}
function runtimeType(value: unknown): string { return Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value; }
function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function deepEqual(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b); }
