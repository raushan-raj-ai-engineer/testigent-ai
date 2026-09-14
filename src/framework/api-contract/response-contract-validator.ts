import { validateSchemaValue } from './schema-validator.js';
import type { OpenApiDocument, OpenApiOperation, OpenApiSchemaLike, ResponseContractResult } from './openapi.types.js';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

/** Validates one HTTP response against the declared OpenAPI status, media type and schema. */
export function validateResponseContract(input: {
  document: OpenApiDocument; method: string; path: string; status: number; body: unknown; contentType?: string;
}): ResponseContractResult {
  const method = input.method.toLowerCase();
  if (!HTTP_METHODS.has(method)) throw new Error(`Unsupported HTTP method '${input.method}'.`);
  const operation = input.document.paths[input.path]?.[method] as OpenApiOperation | undefined;
  if (!operation) throw new Error(`OpenAPI operation not found: ${method.toUpperCase()} ${input.path}`);
  const response = operation.responses?.[String(input.status)] ?? operation.responses?.default;
  if (!response) return failure(method, input, input.contentType ?? 'application/json', '$response', 'status', `Status ${input.status} is not declared by the OpenAPI operation.`);
  const contentType = normalizeContentType(input.contentType ?? 'application/json');
  if (input.contentType && !findContent(response.content, contentType)) return failure(method, input, contentType, '$response.contentType', 'contentType', `Content type '${contentType}' is not declared by the OpenAPI response.`);
  const declared = findContent(response.content, contentType);
  const schema = declared?.schema ?? (!input.contentType ? fallbackJsonSchema(response.content) : undefined);
  // Boolean false is a real OpenAPI 3.1 schema, not an absent schema.
  if (schema === undefined) return { ok: true, method: method.toUpperCase(), path: input.path, status: input.status, contentType, violations: [] };
  const violations = validateSchemaValue(input.document, schema, input.body);
  return { ok: violations.length === 0, method: method.toUpperCase(), path: input.path, status: input.status, contentType, violations };
}

function failure(method: string, input: { path: string; status: number }, contentType: string, path: string, rule: string, message: string): ResponseContractResult {
  return { ok: false, method: method.toUpperCase(), path: input.path, status: input.status, contentType: normalizeContentType(contentType), violations: [{ path, rule, message }] };
}
function normalizeContentType(value: string): string { return value.split(';', 1)[0]!.trim().toLowerCase(); }
function findContent(content: Record<string, { schema?: OpenApiSchemaLike }> | undefined, normalized: string): { schema?: OpenApiSchemaLike } | undefined {
  if (!content) return undefined;
  return Object.entries(content).find(([type]) => normalizeContentType(type) === normalized)?.[1];
}
function fallbackJsonSchema(content: Record<string, { schema?: OpenApiSchemaLike }> | undefined): OpenApiSchemaLike | undefined {
  if (!content) return undefined;
  return Object.entries(content).find(([type]) => normalizeContentType(type).includes('json'))?.[1].schema;
}
