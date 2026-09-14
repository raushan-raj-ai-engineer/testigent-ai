import { resolveSchema } from './openapi-loader.js';
import type { BreakingChange, OpenApiDocument, OpenApiOperation, OpenApiParameter, OpenApiPathItem, OpenApiSchema, OpenApiSchemaLike, OpenApiSchemaType } from './openapi.types.js';

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'] as const;
const DIFF_VALIDATION_KEYS = new Set([
  '$ref','type','nullable','required','properties','items','enum','oneOf','allOf','anyOf','additionalProperties',
  'minimum','maximum','exclusiveMinimum','exclusiveMaximum','minLength','maxLength','pattern','minItems','maxItems','minProperties','maxProperties',
]);
const DIFF_METADATA_KEYS = new Set(['description','default','example','examples','deprecated','readOnly','writeOnly','title']);

/** Conservative OpenAPI compatibility diff. Unsupported semantics are surfaced as INCOMPLETE_COMPARISON instead of false compatibility. */
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
    if (oldParam && !oldParam.required && newParam.required) changes.push({ kind: 'REQUIRED_PARAMETER_ADDED', location: `${location} parameter ${key}`, message: `${newParam.in} parameter '${newParam.name}' became required.` });
    if (oldParam?.schema !== undefined && newParam.schema !== undefined) compareSchema(previous, current, oldParam.schema, newParam.schema, `${location} parameter ${key}`, 'request', changes, new WeakMap());
    else if (oldParam && oldParam.schema === undefined && newParam.schema !== undefined) compareSchema(previous, current, true, newParam.schema, `${location} parameter ${key}`, 'request', changes, new WeakMap());
  }
  for (const [key, oldParam] of oldParams) if (!newParams.has(key)) changes.push({ kind: 'PARAMETER_REMOVED', location: `${location} parameter ${key}`, message: `Previously accepted ${oldParam.in} parameter '${oldParam.name}' was removed.` });
}

function parameterMap(document: OpenApiDocument, parameters: OpenApiParameter[]): Map<string, OpenApiParameter> {
  const map = new Map<string, OpenApiParameter>();
  for (const raw of parameters) {
    const item = resolveParameter(document, raw);
    if (!item.name || !item.in) throw new Error('OPENAPI_UNSUPPORTED_PARAMETER: every parameter must declare name and in.');
    const normalizedName = item.in === 'header' ? item.name.toLowerCase() : item.name;
    map.set(`${item.in}:${normalizedName}`, item);
  }
  return map;
}

function resolveParameter(document: OpenApiDocument, parameter: OpenApiParameter, seen = new Set<string>()): OpenApiParameter {
  if (!parameter.$ref) return parameter;
  const prefix = '#/components/parameters/';
  if (!parameter.$ref.startsWith(prefix)) throw new Error(`Unsupported external OpenAPI parameter $ref '${parameter.$ref}'.`);
  if (seen.has(parameter.$ref)) throw new Error(`Circular OpenAPI parameter reference '${parameter.$ref}'.`);
  const nextSeen = new Set(seen); nextSeen.add(parameter.$ref);
  const name = decodeURIComponent(parameter.$ref.slice(prefix.length)).replace(/~1/g, '/').replace(/~0/g, '~');
  const resolved = document.components?.parameters?.[name];
  if (!resolved) throw new Error(`Unresolved OpenAPI parameter reference '${parameter.$ref}'.`);
  return resolveParameter(document, resolved, nextSeen);
}

function compareResponses(previous: OpenApiDocument, current: OpenApiDocument, oldOperation: OpenApiOperation, newOperation: OpenApiOperation, location: string, changes: BreakingChange[]): void {
  for (const [status, oldResponse] of Object.entries(oldOperation.responses ?? {})) {
    const newResponse = newOperation.responses?.[status];
    if (!newResponse) { changes.push({ kind: 'RESPONSE_REMOVED', location: `${location} response ${status}`, message: `Declared response ${status} was removed.` }); continue; }
    for (const contentType of Object.keys(oldResponse.content ?? {})) if (!newResponse.content?.[contentType]) changes.push({ kind: 'RESPONSE_CONTENT_TYPE_REMOVED', location: `${location} response ${status}`, message: `Response content type '${contentType}' was removed.` });
    const oldSchema = pickJsonSchema(oldResponse.content); const newSchema = pickJsonSchema(newResponse.content);
    if (oldSchema !== undefined && newSchema !== undefined) compareSchema(previous, current, oldSchema, newSchema, `${location} response ${status}`, 'response', changes, new WeakMap());
    else if (oldSchema !== undefined && newSchema === undefined) changes.push({ kind: 'RESPONSE_SCHEMA_REMOVED', location: `${location} response ${status}`, message: 'Previously declared response schema was removed, weakening response guarantees.' });
  }
}

function compareRequests(previous: OpenApiDocument, current: OpenApiDocument, oldOperation: OpenApiOperation, newOperation: OpenApiOperation, location: string, changes: BreakingChange[]): void {
  if (!oldOperation.requestBody?.required && newOperation.requestBody?.required) changes.push({ kind: 'REQUEST_BODY_REQUIRED', location: `${location} request`, message: 'Request body became required.' });
  for (const contentType of Object.keys(oldOperation.requestBody?.content ?? {})) if (!newOperation.requestBody?.content?.[contentType]) changes.push({ kind: 'REQUEST_CONTENT_TYPE_REMOVED', location: `${location} request`, message: `Request content type '${contentType}' was removed.` });
  const oldSchema = pickJsonSchema(oldOperation.requestBody?.content); const newSchema = pickJsonSchema(newOperation.requestBody?.content);
  if (newSchema !== undefined) compareSchema(previous, current, oldSchema ?? true, newSchema, `${location} request`, 'request', changes, new WeakMap());
}

type SeenPairs = WeakMap<object, WeakSet<object>>;
function compareSchema(previous: OpenApiDocument, current: OpenApiDocument, oldInput: OpenApiSchemaLike, newInput: OpenApiSchemaLike, location: string, direction: 'request' | 'response', changes: BreakingChange[], seen: SeenPairs): void {
  const oldResolved = resolveSchema(previous, oldInput);
  const newResolved = resolveSchema(current, newInput);

  // JSON Schema `true` is semantically equivalent to an empty schema: it accepts every value.
  // Normalize it to an unconstrained object schema so granular compatibility checks still run.
  // In particular, true -> { required: [...] } must surface REQUEST_REQUIRED_ADDED in addition
  // to the broader REQUEST_CONSTRAINT_TIGHTENED diagnostic.
  //
  // `false` is different: it accepts no values and needs explicit directional handling.
  if (oldResolved === false || newResolved === false) {
    compareBooleanSchema(oldResolved, newResolved, location, direction, changes);
    return;
  }

  const oldSchema: OpenApiSchema = oldResolved === true ? {} : oldResolved;
  const newSchema: OpenApiSchema = newResolved === true ? {} : newResolved;

  if (pairSeen(seen, oldSchema, newSchema)) return;

  flagUnsupportedDiffKeywords(oldSchema, newSchema, location, changes);
  compareTypeSets(oldSchema, newSchema, location, direction, changes);
  compareEnums(oldSchema, newSchema, location, direction, changes);
  compareRequired(oldSchema, newSchema, location, direction, changes);
  compareBounds(previous, current, oldSchema, newSchema, location, direction, changes);
  compareSizedConstraint('minLength', oldSchema.minLength, newSchema.minLength, location, direction, 'minimum string length', changes);
  compareSizedConstraint('maxLength', oldSchema.maxLength, newSchema.maxLength, location, direction, 'maximum string length', changes, true);
  compareSizedConstraint('minItems', oldSchema.minItems, newSchema.minItems, location, direction, 'minimum array length', changes);
  compareSizedConstraint('maxItems', oldSchema.maxItems, newSchema.maxItems, location, direction, 'maximum array length', changes, true);
  compareSizedConstraint('minProperties', oldSchema.minProperties, newSchema.minProperties, location, direction, 'minimum object property count', changes);
  compareSizedConstraint('maxProperties', oldSchema.maxProperties, newSchema.maxProperties, location, direction, 'maximum object property count', changes, true);
  comparePattern(oldSchema.pattern, newSchema.pattern, location, direction, changes);
  compareAdditionalProperties(oldSchema.additionalProperties, newSchema.additionalProperties, location, direction, changes);

  // Compare the effective schema for every property named on either side. When a declaration disappears,
  // JSON Schema falls back to additionalProperties (false => prohibited, schema => constrained, true/absent => unconstrained).
  // This prevents optional property removals from being silently skipped and keeps request/response directionality intact.
  const propertyKeys = new Set([
    ...Object.keys(oldSchema.properties ?? {}),
    ...Object.keys(newSchema.properties ?? {}),
  ]);
  for (const key of propertyKeys) {
    const oldChild = effectivePropertySchema(oldSchema, key);
    const newChild = effectivePropertySchema(newSchema, key);
    compareSchema(previous, current, oldChild, newChild, `${location}.${key}`, direction, changes, seen);
  }
  if (oldSchema.items !== undefined && newSchema.items !== undefined) compareSchema(previous, current, oldSchema.items, newSchema.items, `${location}[]`, direction, changes, seen);
  else if (direction === 'request' && oldSchema.items === undefined && newSchema.items !== undefined) compareSchema(previous, current, true, newSchema.items, `${location}[]`, direction, changes, seen);
  else if (direction === 'response' && oldSchema.items !== undefined && newSchema.items === undefined) changes.push({ kind: 'RESPONSE_GUARANTEE_WEAKENED', location: `${location}[]`, message: 'Response item schema guarantee was removed.' });

  compareComposition(previous, current, 'allOf', oldSchema.allOf, newSchema.allOf, location, direction, changes, seen);
  compareComposition(previous, current, 'oneOf', oldSchema.oneOf, newSchema.oneOf, location, direction, changes, seen);
  compareComposition(previous, current, 'anyOf', oldSchema.anyOf, newSchema.anyOf, location, direction, changes, seen);
}


function effectivePropertySchema(schema: OpenApiSchema, key: string): OpenApiSchemaLike {
  const declared = schema.properties?.[key];
  if (declared !== undefined) return declared;
  if (schema.additionalProperties === false) return false;
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') return schema.additionalProperties;
  return true;
}

function compareBooleanSchema(oldSchema: OpenApiSchemaLike, newSchema: OpenApiSchemaLike, location: string, direction: 'request' | 'response', changes: BreakingChange[]): void {
  if (oldSchema === newSchema) return;

  // Compatibility can be decided exactly for boolean-schema transitions because true is the universal
  // set and false is the empty set. Requests break when the accepted-input set narrows; responses break
  // when the possible-output set widens.
  if (direction === 'request') {
    if (oldSchema === false || newSchema === true) return;
    if (newSchema === false) {
      changes.push({ kind: 'REQUEST_CONSTRAINT_TIGHTENED', location, message: 'Request schema now rejects values that were previously accepted.' });
      return;
    }
    if (oldSchema === true && typeof newSchema === 'object') {
      changes.push({ kind: 'REQUEST_CONSTRAINT_TIGHTENED', location, message: 'Request schema introduced constraints where values were previously unconstrained.' });
    }
    return;
  }

  if (newSchema === false || oldSchema === true) return;
  if (oldSchema === false) {
    changes.push({ kind: 'RESPONSE_GUARANTEE_WEAKENED', location, message: 'Response schema can now emit values where none were previously permitted.' });
    return;
  }
  if (newSchema === true && typeof oldSchema === 'object') {
    changes.push({ kind: 'RESPONSE_GUARANTEE_WEAKENED', location, message: 'Response schema removed previous value constraints.' });
  }
}

function compareTypeSets(oldSchema: OpenApiSchema, newSchema: OpenApiSchema, location: string, direction: 'request' | 'response', changes: BreakingChange[]): void {
  const oldTypes = effectiveTypes(oldSchema); const newTypes = effectiveTypes(newSchema);
  if (!oldTypes && !newTypes) return;
  if (!oldTypes && newTypes) {
    if (direction === 'request') changes.push({ kind: 'REQUEST_CONSTRAINT_TIGHTENED', location, message: `Request type became constrained to ${[...newTypes].sort().join('|')}.` });
    return;
  }
  if (oldTypes && !newTypes) {
    if (direction === 'response') changes.push({ kind: 'RESPONSE_GUARANTEE_WEAKENED', location, message: `Response type guarantee ${[...oldTypes].sort().join('|')} was removed.` });
    return;
  }
  if (!oldTypes || !newTypes) return;
  const oldOnly = [...oldTypes].filter(x => !newTypes.has(x)); const newOnly = [...newTypes].filter(x => !oldTypes.has(x));
  if (oldOnly.length || newOnly.length) changes.push({ kind: 'SCHEMA_TYPE_CHANGED', location, message: `Schema type set changed from ${[...oldTypes].sort().join('|')} to ${[...newTypes].sort().join('|')}.` });
  if (direction === 'request' && oldOnly.length) changes.push({ kind: 'REQUEST_CONSTRAINT_TIGHTENED', location, message: `Request no longer accepts type(s): ${oldOnly.sort().join(', ')}.` });
  if (direction === 'response' && newOnly.length) changes.push({ kind: 'RESPONSE_GUARANTEE_WEAKENED', location, message: `Response may now emit additional type(s): ${newOnly.sort().join(', ')}.` });
}

function effectiveTypes(schema: OpenApiSchema): Set<OpenApiSchemaType> | undefined {
  if (!schema.type) return schema.nullable ? new Set<OpenApiSchemaType>(['null']) : undefined;
  const set = new Set<OpenApiSchemaType>(Array.isArray(schema.type) ? schema.type : [schema.type]);
  if (schema.nullable) set.add('null');
  return set;
}

function compareEnums(oldSchema: OpenApiSchema, newSchema: OpenApiSchema, location: string, direction: 'request' | 'response', changes: BreakingChange[]): void {
  const oldEnum = oldSchema.enum; const newEnum = newSchema.enum;
  if (direction === 'request') {
    if (!oldEnum && newEnum) { changes.push({ kind: 'REQUEST_CONSTRAINT_TIGHTENED', location, message: 'Request enum was introduced, restricting previously accepted values.' }); return; }
    if (oldEnum && newEnum) for (const value of oldEnum) if (!contains(newEnum, value)) changes.push({ kind: 'ENUM_VALUE_REMOVED', location, message: `Request enum value ${JSON.stringify(value)} was removed.` });
  } else {
    if (oldEnum && !newEnum) { changes.push({ kind: 'RESPONSE_GUARANTEE_WEAKENED', location, message: 'Response enum guarantee was removed and may emit previously unknown values.' }); return; }
    if (oldEnum && newEnum) for (const value of newEnum) if (!contains(oldEnum, value)) changes.push({ kind: 'RESPONSE_ENUM_VALUE_ADDED', location, message: `Response enum value ${JSON.stringify(value)} was added and may be unknown to existing consumers.` });
  }
}

function compareRequired(
  oldSchema: OpenApiSchema,
  newSchema: OpenApiSchema,
  location: string,
  direction: 'request' | 'response',
  changes: BreakingChange[],
): void {
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
    return;
  }

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

function compareBounds(previous: OpenApiDocument, current: OpenApiDocument, oldSchema: OpenApiSchema, newSchema: OpenApiSchema, location: string, direction: 'request' | 'response', changes: BreakingChange[]): void {
  const oldLower = lowerBound(previous, oldSchema); const newLower = lowerBound(current, newSchema);
  const oldUpper = upperBound(previous, oldSchema); const newUpper = upperBound(current, newSchema);
  if (direction === 'request') {
    if (isLowerTighter(oldLower, newLower)) changes.push({ kind: 'REQUEST_CONSTRAINT_TIGHTENED', location, message: `Request lower bound tightened from ${formatBound(oldLower, '-∞')} to ${formatBound(newLower, '-∞')}.` });
    if (isUpperTighter(oldUpper, newUpper)) changes.push({ kind: 'REQUEST_CONSTRAINT_TIGHTENED', location, message: `Request upper bound tightened from ${formatBound(oldUpper, '+∞')} to ${formatBound(newUpper, '+∞')}.` });
  } else {
    if (isLowerLooser(oldLower, newLower)) changes.push({ kind: 'RESPONSE_GUARANTEE_WEAKENED', location, message: `Response lower-bound guarantee weakened from ${formatBound(oldLower, '-∞')} to ${formatBound(newLower, '-∞')}.` });
    if (isUpperLooser(oldUpper, newUpper)) changes.push({ kind: 'RESPONSE_GUARANTEE_WEAKENED', location, message: `Response upper-bound guarantee weakened from ${formatBound(oldUpper, '+∞')} to ${formatBound(newUpper, '+∞')}.` });
  }
}

type Bound = { value: number; exclusive: boolean } | undefined;
function lowerBound(document: OpenApiDocument, schema: OpenApiSchema): Bound {
  if (typeof schema.exclusiveMinimum === 'number') return { value: schema.exclusiveMinimum, exclusive: true };
  if (schema.minimum === undefined) return undefined;
  return { value: schema.minimum, exclusive: /^3\.0\./.test(document.openapi) && schema.exclusiveMinimum === true };
}
function upperBound(document: OpenApiDocument, schema: OpenApiSchema): Bound {
  if (typeof schema.exclusiveMaximum === 'number') return { value: schema.exclusiveMaximum, exclusive: true };
  if (schema.maximum === undefined) return undefined;
  return { value: schema.maximum, exclusive: /^3\.0\./.test(document.openapi) && schema.exclusiveMaximum === true };
}
function isLowerTighter(oldB: Bound, newB: Bound): boolean { if (!newB) return false; if (!oldB) return true; return newB.value > oldB.value || (newB.value === oldB.value && newB.exclusive && !oldB.exclusive); }
function isUpperTighter(oldB: Bound, newB: Bound): boolean { if (!newB) return false; if (!oldB) return true; return newB.value < oldB.value || (newB.value === oldB.value && newB.exclusive && !oldB.exclusive); }
function isLowerLooser(oldB: Bound, newB: Bound): boolean { if (!oldB) return false; if (!newB) return true; return newB.value < oldB.value || (newB.value === oldB.value && oldB.exclusive && !newB.exclusive); }
function isUpperLooser(oldB: Bound, newB: Bound): boolean { if (!oldB) return false; if (!newB) return true; return newB.value > oldB.value || (newB.value === oldB.value && oldB.exclusive && !newB.exclusive); }
function formatBound(bound: Bound, none: string): string { return bound ? `${bound.exclusive ? '(' : '['}${bound.value}` : none; }

function compareSizedConstraint(name: string, oldValue: number | undefined, newValue: number | undefined, location: string, direction: 'request' | 'response', label: string, changes: BreakingChange[], upper = false): void {
  if (direction === 'request') {
    const tighter = upper ? (newValue !== undefined && (oldValue === undefined || newValue < oldValue)) : (newValue !== undefined && (oldValue === undefined || newValue > oldValue));
    if (tighter) changes.push({ kind: 'REQUEST_CONSTRAINT_TIGHTENED', location, message: `Request ${label} tightened from ${oldValue ?? 'unbounded'} to ${newValue}.` });
  } else {
    const looser = upper ? (oldValue !== undefined && (newValue === undefined || newValue > oldValue)) : (oldValue !== undefined && (newValue === undefined || newValue < oldValue));
    if (looser) changes.push({ kind: 'RESPONSE_GUARANTEE_WEAKENED', location, message: `Response ${label} guarantee weakened from ${oldValue} to ${newValue ?? 'unbounded'}.` });
  }
  void name;
}

function comparePattern(oldPattern: string | undefined, newPattern: string | undefined, location: string, direction: 'request' | 'response', changes: BreakingChange[]): void {
  if (oldPattern === newPattern) return;
  if (direction === 'request' && newPattern !== undefined) changes.push({ kind: 'INCOMPLETE_COMPARISON', location, message: `Request pattern changed (${oldPattern ?? '<none>'} -> ${newPattern}); compatibility cannot be proven statically.` });
  if (direction === 'response' && oldPattern !== undefined) changes.push({ kind: 'INCOMPLETE_COMPARISON', location, message: `Response pattern changed (${oldPattern} -> ${newPattern ?? '<none>'}); compatibility cannot be proven statically.` });
}

function compareAdditionalProperties(oldValue: OpenApiSchema['additionalProperties'], newValue: OpenApiSchema['additionalProperties'], location: string, direction: 'request' | 'response', changes: BreakingChange[]): void {
  const oldAllows = oldValue !== false; const newAllows = newValue !== false;
  if (direction === 'request' && oldAllows && !newAllows) changes.push({ kind: 'REQUEST_CONSTRAINT_TIGHTENED', location, message: 'Request now rejects additional object properties.' });
  if (direction === 'response' && !oldAllows && newAllows) changes.push({ kind: 'RESPONSE_GUARANTEE_WEAKENED', location, message: 'Response may now contain additional object properties.' });
  if (typeof oldValue === 'object' || typeof newValue === 'object') {
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) changes.push({ kind: 'INCOMPLETE_COMPARISON', location, message: 'additionalProperties schema changed; compatibility requires schema-aware comparison.' });
  }
}

function compareComposition(previous: OpenApiDocument, current: OpenApiDocument, keyword: 'allOf' | 'oneOf' | 'anyOf', oldItems: OpenApiSchemaLike[] | undefined, newItems: OpenApiSchemaLike[] | undefined, location: string, direction: 'request' | 'response', changes: BreakingChange[], seen: SeenPairs): void {
  if (!oldItems?.length && !newItems?.length) return;
  if (!oldItems?.length || !newItems?.length) {
    changes.push({ kind: 'INCOMPLETE_COMPARISON', location, message: `${keyword} composition was ${newItems?.length ? 'introduced' : 'removed'}; compatibility cannot be proven comprehensively.` });
    return;
  }
  if (oldItems.length !== newItems.length) {
    const breakingByCount = keyword === 'allOf'
      ? (direction === 'request' ? newItems.length > oldItems.length : newItems.length < oldItems.length)
      : (direction === 'request' ? newItems.length < oldItems.length : newItems.length > oldItems.length);
    changes.push({ kind: breakingByCount ? (direction === 'request' ? 'REQUEST_CONSTRAINT_TIGHTENED' : 'RESPONSE_GUARANTEE_WEAKENED') : 'INCOMPLETE_COMPARISON', location, message: `${keyword} branch count changed from ${oldItems.length} to ${newItems.length}.` });
  }
  const length = Math.min(oldItems.length, newItems.length);
  for (let i = 0; i < length; i++) compareSchema(previous, current, oldItems[i]!, newItems[i]!, `${location}.${keyword}[${i}]`, direction, changes, seen);
}

function flagUnsupportedDiffKeywords(oldSchema: OpenApiSchema, newSchema: OpenApiSchema, location: string, changes: BreakingChange[]): void {
  const unsupported = new Set<string>();
  for (const key of new Set([...Object.keys(oldSchema), ...Object.keys(newSchema)])) {
    if (DIFF_VALIDATION_KEYS.has(key) || DIFF_METADATA_KEYS.has(key)) continue;
    // An unchanged unsupported annotation/constraint cannot itself create a compatibility break.
    // If it changes, however, we must fail closed rather than claim a comprehensive no-break result.
    if (JSON.stringify((oldSchema as Record<string, unknown>)[key]) !== JSON.stringify((newSchema as Record<string, unknown>)[key])) unsupported.add(key);
  }
  if (unsupported.size) changes.push({ kind: 'INCOMPLETE_COMPARISON', location, message: `Compatibility comparison does not implement changed validation keyword(s): ${[...unsupported].sort().join(', ')}.` });
}

function pairSeen(seen: SeenPairs, left: object, right: object): boolean { let rights = seen.get(left); if (!rights) { rights = new WeakSet<object>(); seen.set(left, rights); } if (rights.has(right)) return true; rights.add(right); return false; }
function pickJsonSchema(content: Record<string, { schema?: OpenApiSchemaLike }> | undefined): OpenApiSchemaLike | undefined { if (!content) return undefined; return content['application/json']?.schema ?? Object.entries(content).find(([type]) => type.toLowerCase().includes('json'))?.[1].schema; }
function contains(items: unknown[], value: unknown): boolean { return items.some(item => JSON.stringify(item) === JSON.stringify(value)); }
function dedupe(changes: BreakingChange[]): BreakingChange[] { const seen = new Set<string>(); return changes.filter(change => { const key = `${change.kind}|${change.location}|${change.message}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
