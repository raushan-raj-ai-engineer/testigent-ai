import { resolveSchema } from './openapi-loader.js';
import type { OpenApiDocument, OpenApiSchema, OpenApiSchemaType, SchemaViolation } from './openapi.types.js';

const SUPPORTED_SCHEMA_KEYS = new Set([
  '$ref', 'type', 'nullable', 'required', 'properties', 'items', 'enum', 'oneOf', 'allOf', 'anyOf',
  'additionalProperties', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minLength',
  'maxLength', 'pattern', 'minItems', 'maxItems', 'minProperties', 'maxProperties', 'description',
  'default', 'example', 'examples', 'deprecated', 'readOnly', 'writeOnly', 'title',
]);

/** Deterministic OpenAPI schema validation that fails closed when a schema uses unsupported keywords. */
export function validateSchemaValue(document: OpenApiDocument, schema: OpenApiSchema, value: unknown, rootPath = '$'): SchemaViolation[] {
  const resolved = resolveSchema(document, schema);
  const violations: SchemaViolation[] = [];

  for (const key of Object.keys(resolved)) {
    if (!SUPPORTED_SCHEMA_KEYS.has(key)) {
      violations.push({ path: rootPath, rule: 'unsupported', message: `Unsupported schema keyword '${key}' cannot be validated safely.` });
    }
  }

  const is31 = /^3\.1\./.test(document.openapi);
  if (!is31 && Array.isArray(resolved.type)) violations.push({ path: rootPath, rule: 'unsupported', message: 'OpenAPI 3.0 does not support JSON Schema type arrays.' });
  if (is31 && resolved.nullable !== undefined) violations.push({ path: rootPath, rule: 'unsupported', message: "OpenAPI 3.1 uses a 'null' type instead of nullable." });
  if (is31 && typeof resolved.exclusiveMinimum === 'boolean') violations.push({ path: rootPath, rule: 'unsupported', message: 'OpenAPI 3.1 exclusiveMinimum must be numeric.' });
  if (is31 && typeof resolved.exclusiveMaximum === 'boolean') violations.push({ path: rootPath, rule: 'unsupported', message: 'OpenAPI 3.1 exclusiveMaximum must be numeric.' });
  if (!is31 && typeof resolved.exclusiveMinimum === 'number') violations.push({ path: rootPath, rule: 'unsupported', message: 'OpenAPI 3.0 exclusiveMinimum is boolean and requires minimum.' });
  if (!is31 && typeof resolved.exclusiveMaximum === 'number') violations.push({ path: rootPath, rule: 'unsupported', message: 'OpenAPI 3.0 exclusiveMaximum is boolean and requires maximum.' });

  if (resolved.allOf?.length) {
    for (const item of resolved.allOf) violations.push(...validateSchemaValue(document, item, value, rootPath));
  }
  if (resolved.oneOf?.length) {
    const passing = resolved.oneOf.map(item => validateSchemaValue(document, item, value, rootPath)).filter(items => items.length === 0).length;
    if (passing !== 1) violations.push({ path: rootPath, rule: 'oneOf', message: `Expected exactly one schema to match; matched ${passing}.` });
  }
  if (resolved.anyOf?.length) {
    const passing = resolved.anyOf.some(item => validateSchemaValue(document, item, value, rootPath).length === 0);
    if (!passing) violations.push({ path: rootPath, rule: 'anyOf', message: 'Value did not match any allowed schema.' });
  }

  if (value === null) {
    if (allowsNull(resolved)) return violations;
    violations.push({ path: rootPath, rule: 'nullable', message: 'Value is null but schema is not nullable.' });
    return violations;
  }

  if (resolved.enum && !resolved.enum.some(item => deepEqual(item, value))) {
    violations.push({ path: rootPath, rule: 'enum', message: 'Value is not in the allowed enum.' });
  }

  if (resolved.type && !matchesType(resolved.type, value)) {
    violations.push({ path: rootPath, rule: 'type', message: `Expected ${formatType(resolved.type)}; received ${runtimeType(value)}.` });
    return violations;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (resolved.minimum !== undefined && value < resolved.minimum) violations.push({ path: rootPath, rule: 'minimum', message: `Value must be >= ${resolved.minimum}.` });
    if (resolved.maximum !== undefined && value > resolved.maximum) violations.push({ path: rootPath, rule: 'maximum', message: `Value must be <= ${resolved.maximum}.` });
    if (typeof resolved.exclusiveMinimum === 'number' && value <= resolved.exclusiveMinimum) violations.push({ path: rootPath, rule: 'exclusiveMinimum', message: `Value must be > ${resolved.exclusiveMinimum}.` });
    if (typeof resolved.exclusiveMaximum === 'number' && value >= resolved.exclusiveMaximum) violations.push({ path: rootPath, rule: 'exclusiveMaximum', message: `Value must be < ${resolved.exclusiveMaximum}.` });
    if (resolved.exclusiveMinimum === true && resolved.minimum !== undefined && value <= resolved.minimum) violations.push({ path: rootPath, rule: 'exclusiveMinimum', message: `Value must be > ${resolved.minimum}.` });
    if (resolved.exclusiveMaximum === true && resolved.maximum !== undefined && value >= resolved.maximum) violations.push({ path: rootPath, rule: 'exclusiveMaximum', message: `Value must be < ${resolved.maximum}.` });
  }

  if (typeof value === 'string') {
    if (resolved.minLength !== undefined && value.length < resolved.minLength) violations.push({ path: rootPath, rule: 'minLength', message: `String length must be >= ${resolved.minLength}.` });
    if (resolved.maxLength !== undefined && value.length > resolved.maxLength) violations.push({ path: rootPath, rule: 'maxLength', message: `String length must be <= ${resolved.maxLength}.` });
    if (resolved.pattern !== undefined) {
      try { if (!new RegExp(resolved.pattern).test(value)) violations.push({ path: rootPath, rule: 'pattern', message: `String does not match pattern '${resolved.pattern}'.` }); }
      catch { violations.push({ path: rootPath, rule: 'unsupported', message: `Invalid schema pattern '${resolved.pattern}'.` }); }
    }
  }

  if (isObject(value) && (hasType(resolved, 'object') || resolved.properties || resolved.required || resolved.additionalProperties !== undefined)) {
    const keys = Object.keys(value);
    if (resolved.minProperties !== undefined && keys.length < resolved.minProperties) violations.push({ path: rootPath, rule: 'minProperties', message: `Object must contain at least ${resolved.minProperties} properties.` });
    if (resolved.maxProperties !== undefined && keys.length > resolved.maxProperties) violations.push({ path: rootPath, rule: 'maxProperties', message: `Object must contain at most ${resolved.maxProperties} properties.` });
    for (const required of resolved.required ?? []) {
      if (!(required in value)) violations.push({ path: `${rootPath}.${required}`, rule: 'required', message: 'Required property is missing.' });
    }
    for (const [key, child] of Object.entries(resolved.properties ?? {})) {
      if (key in value) violations.push(...validateSchemaValue(document, child, value[key], `${rootPath}.${key}`));
    }
    if (resolved.additionalProperties === false) {
      for (const key of keys) if (!(key in (resolved.properties ?? {}))) violations.push({ path: `${rootPath}.${key}`, rule: 'additionalProperties', message: 'Additional property is not allowed.' });
    } else if (resolved.additionalProperties && typeof resolved.additionalProperties === 'object') {
      for (const key of keys) if (!(key in (resolved.properties ?? {}))) violations.push(...validateSchemaValue(document, resolved.additionalProperties, value[key], `${rootPath}.${key}`));
    }
  }

  if (Array.isArray(value) && (hasType(resolved, 'array') || resolved.items)) {
    if (resolved.minItems !== undefined && value.length < resolved.minItems) violations.push({ path: rootPath, rule: 'minItems', message: `Array must contain at least ${resolved.minItems} items.` });
    if (resolved.maxItems !== undefined && value.length > resolved.maxItems) violations.push({ path: rootPath, rule: 'maxItems', message: `Array must contain at most ${resolved.maxItems} items.` });
    if (resolved.items) value.forEach((item, index) => violations.push(...validateSchemaValue(document, resolved.items!, item, `${rootPath}[${index}]`)));
  }

  return violations;
}

function allowsNull(schema: OpenApiSchema): boolean { return schema.nullable === true || hasType(schema, 'null'); }
function hasType(schema: OpenApiSchema, type: OpenApiSchemaType): boolean { return Array.isArray(schema.type) ? schema.type.includes(type) : schema.type === type; }
function matchesType(type: OpenApiSchema['type'], value: unknown): boolean {
  const types = Array.isArray(type) ? type : [type];
  return types.some(item => item !== undefined && matchesSingleType(item, value));
}
function matchesSingleType(type: OpenApiSchemaType, value: unknown): boolean {
  switch (type) {
    case 'object': return isObject(value);
    case 'array': return Array.isArray(value);
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'integer': return typeof value === 'number' && Number.isInteger(value);
    case 'boolean': return typeof value === 'boolean';
    case 'null': return value === null;
  }
}
function formatType(type: OpenApiSchema['type']): string { return Array.isArray(type) ? type.join('|') : String(type); }
function runtimeType(value: unknown): string { return Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value; }
function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function deepEqual(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b); }
