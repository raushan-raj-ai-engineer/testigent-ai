import { resolveSchema } from './openapi-loader.js';
import type { BreakingChange, OpenApiDocument, OpenApiOperation, OpenApiParameter, OpenApiPathItem, OpenApiSchema } from './openapi.types.js';

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'] as const;

/** Conservative OpenAPI compatibility diff with parameter coverage and cycle-safe schema comparison. */
export function detectBreakingChanges(previous: OpenApiDocument, current: OpenApiDocument): BreakingChange[] {
  const changes: BreakingChange[] = [];
  for (const [apiPath, oldPath] of Object.entries(previous.paths)) {
    const newPath = current.paths[apiPath];
    if (!newPath) { changes.push({ kind: 'PATH_REMOVED', location: apiPath, message: `Path '${apiPath}' was removed.` }); continue; }
    for (const method of METHODS) {
      const oldOperation = oldPath[method] as OpenApiOperation | undefined;
      if (!oldOperation) continue;
      const newOperation = newPath[method] as OpenApiOperation | undefined;
      const operationLocation = `${method.toUpperCase()} ${apiPath}`;
      if (!newOperation) { changes.push({ kind: 'METHOD_REMOVED', location: operationLocation, message: `${operationLocation} was removed.` }); continue; }
      compareParameters(previous, current, oldPath, newPath, oldOperation, newOperation, operationLocation, changes);
      compareResponses(previous, current, oldOperation, newOperation, operationLocation, changes);
      compareRequests(previous, current, oldOperation, newOperation, operationLocation, changes);
    }
  }
  return dedupe(changes);
}

function compareParameters(previous: OpenApiDocument, current: OpenApiDocument, oldPath: OpenApiPathItem, newPath: OpenApiPathItem, oldOperation: OpenApiOperation, newOperation: OpenApiOperation, location: string, changes: BreakingChange[]): void {
  const oldParams = parameterMap(previous, [...(oldPath.parameters ?? []), ...(oldOperation.parameters ?? [])]);
  const newParams = parameterMap(current, [...(newPath.parameters ?? []), ...(newOperation.parameters ?? [])]);
  for (const [key, newParam] of newParams) {
    const oldParam = oldParams.get(key);
    if (!oldParam && newParam.required) {
      changes.push({ kind: 'REQUIRED_PARAMETER_ADDED', location: `${location} parameter ${key}`, message: `Required ${newParam.in} parameter '${newParam.name}' was added.` });
      continue;
    }
    if (oldParam && !oldParam.required && newParam.required) {
      changes.push({ kind: 'REQUIRED_PARAMETER_ADDED', location: `${location} parameter ${key}`, message: `${newParam.in} parameter '${newParam.name}' became required.` });
    }
    if (oldParam?.schema && newParam.schema) compareSchema(previous, current, oldParam.schema, newParam.schema, `${location} parameter ${key}`, 'request', changes, new WeakMap());
  }
  for (const [key, oldParam] of oldParams) {
    if (!newParams.has(key)) changes.push({ kind: 'PARAMETER_REMOVED', location: `${location} parameter ${key}`, message: `Previously accepted ${oldParam.in} parameter '${oldParam.name}' was removed.` });
  }
}

function parameterMap(document: OpenApiDocument, parameters: OpenApiParameter[]): Map<string, OpenApiParameter> {
  const map = new Map<string, OpenApiParameter>();
  for (const raw of parameters) {
    const item = resolveParameter(document, raw);
    if (!item.name || !item.in) throw new Error('OPENAPI_UNSUPPORTED_PARAMETER: every parameter must declare name and in.');
    map.set(`${item.in}:${item.name.toLowerCase()}`, item);
  }
  return map;
}

function resolveParameter(document: OpenApiDocument, parameter: OpenApiParameter, seen = new Set<string>()): OpenApiParameter {
  if (!parameter.$ref) return parameter;
  const prefix = '#/components/parameters/';
  if (!parameter.$ref.startsWith(prefix)) throw new Error(`Unsupported external OpenAPI parameter $ref '${parameter.$ref}'.`);
  if (seen.has(parameter.$ref)) throw new Error(`Circular OpenAPI parameter reference '${parameter.$ref}'.`);
  seen.add(parameter.$ref);
  const name = decodeURIComponent(parameter.$ref.slice(prefix.length));
  const resolved = document.components?.parameters?.[name];
  if (!resolved) throw new Error(`Unresolved OpenAPI parameter reference '${parameter.$ref}'.`);
  return resolveParameter(document, resolved, seen);
}

function compareResponses(previous: OpenApiDocument, current: OpenApiDocument, oldOperation: OpenApiOperation, newOperation: OpenApiOperation, location: string, changes: BreakingChange[]): void {
  for (const [status, oldResponse] of Object.entries(oldOperation.responses ?? {})) {
    const newResponse = newOperation.responses?.[status];
    if (!newResponse) { changes.push({ kind: 'RESPONSE_REMOVED', location: `${location} response ${status}`, message: `Declared response ${status} was removed.` }); continue; }
    for (const contentType of Object.keys(oldResponse.content ?? {})) if (!newResponse.content?.[contentType]) changes.push({ kind: 'RESPONSE_CONTENT_TYPE_REMOVED', location: `${location} response ${status}`, message: `Response content type '${contentType}' was removed.` });
    const oldSchema = pickJsonSchema(oldResponse.content); const newSchema = pickJsonSchema(newResponse.content);
    if (oldSchema && newSchema) compareSchema(previous, current, oldSchema, newSchema, `${location} response ${status}`, 'response', changes, new WeakMap());
  }
}

function compareRequests(previous: OpenApiDocument, current: OpenApiDocument, oldOperation: OpenApiOperation, newOperation: OpenApiOperation, location: string, changes: BreakingChange[]): void {
  if (!oldOperation.requestBody?.required && newOperation.requestBody?.required) changes.push({ kind: 'REQUEST_BODY_REQUIRED', location: `${location} request`, message: 'Request body became required.' });
  for (const contentType of Object.keys(oldOperation.requestBody?.content ?? {})) if (!newOperation.requestBody?.content?.[contentType]) changes.push({ kind: 'REQUEST_CONTENT_TYPE_REMOVED', location: `${location} request`, message: `Request content type '${contentType}' was removed.` });
  const oldSchema = pickJsonSchema(oldOperation.requestBody?.content); const newSchema = pickJsonSchema(newOperation.requestBody?.content);
  if (newSchema) compareSchema(previous, current, oldSchema ?? { type: 'object' }, newSchema, `${location} request`, 'request', changes, new WeakMap());
}

type SeenPairs = WeakMap<object, WeakSet<object>>;
function compareSchema(previous: OpenApiDocument, current: OpenApiDocument, oldInput: OpenApiSchema, newInput: OpenApiSchema, location: string, direction: 'request' | 'response', changes: BreakingChange[], seen: SeenPairs): void {
  const oldSchema = resolveSchema(previous, oldInput); const newSchema = resolveSchema(current, newInput);
  if (pairSeen(seen, oldSchema, newSchema)) return;
  const oldType = normalizedType(oldSchema.type); const newType = normalizedType(newSchema.type);
  if (oldType && newType && oldType !== newType) changes.push({ kind: 'SCHEMA_TYPE_CHANGED', location, message: `Schema type changed from ${oldType} to ${newType}.` });
  if (oldSchema.enum && newSchema.enum) {
    if (direction === 'request') {
      for (const value of oldSchema.enum) {
        if (!newSchema.enum.some(item => JSON.stringify(item) === JSON.stringify(value))) {
          changes.push({
            kind: 'ENUM_VALUE_REMOVED',
            location,
            message: `Request enum value ${JSON.stringify(value)} was removed.`,
          });
        }
      }
    } else {
      for (const value of newSchema.enum) {
        if (!oldSchema.enum.some(item => JSON.stringify(item) === JSON.stringify(value))) {
          changes.push({
            kind: 'RESPONSE_ENUM_VALUE_ADDED',
            location,
            message: `Response enum value ${JSON.stringify(value)} was added and may be unknown to existing consumers.`,
          });
        }
      }
    }
  }

  const oldRequired = new Set(oldSchema.required ?? []);
  const newRequired = new Set(newSchema.required ?? []);

  if (direction === 'request') {
    for (const key of newRequired) {
      if (!oldRequired.has(key)) {
        changes.push({
          kind: 'REQUEST_REQUIRED_ADDED',
          location: `${location}.${key}`,
          message: `Request property '${key}' became required.`,
        });
      }
    }
  } else {
    for (const key of oldRequired) {
      if (!newRequired.has(key)) {
        changes.push({
          kind: 'RESPONSE_REQUIRED_REMOVED',
          location: `${location}.${key}`,
          message: `Previously guaranteed response property '${key}' is no longer required.`,
        });
      }
    }
  }
  for (const [key, oldChild] of Object.entries(oldSchema.properties ?? {})) { const newChild = newSchema.properties?.[key]; if (newChild) compareSchema(previous, current, oldChild, newChild, `${location}.${key}`, direction, changes, seen); }
  if (oldSchema.items && newSchema.items) compareSchema(previous, current, oldSchema.items, newSchema.items, `${location}[]`, direction, changes, seen);
}

function pairSeen(seen: SeenPairs, left: object, right: object): boolean { let rights = seen.get(left); if (!rights) { rights = new WeakSet<object>(); seen.set(left, rights); } if (rights.has(right)) return true; rights.add(right); return false; }
function normalizedType(type: OpenApiSchema['type']): string | undefined { return Array.isArray(type) ? [...type].sort().join('|') : type; }
function pickJsonSchema(content: Record<string, { schema?: OpenApiSchema }> | undefined): OpenApiSchema | undefined { if (!content) return undefined; return content['application/json']?.schema ?? Object.entries(content).find(([type]) => type.includes('json'))?.[1].schema; }
function dedupe(changes: BreakingChange[]): BreakingChange[] { const seen = new Set<string>(); return changes.filter(change => { const key = `${change.kind}|${change.location}|${change.message}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
