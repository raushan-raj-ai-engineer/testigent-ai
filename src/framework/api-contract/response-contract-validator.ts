import { validateSchemaValue } from './schema-validator.js';
import type { OpenApiDocument, OpenApiOperation, OpenApiSchema, ResponseContractResult } from './openapi.types.js';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

/** Validates one HTTP response against the declared OpenAPI status, media type and schema. */
export function validateResponseContract(input: {
  document: OpenApiDocument;
  method: string;
  path: string;
  status: number;
  body: unknown;
  contentType?: string;
}): ResponseContractResult {
  const method = input.method.toLowerCase();
  if (!HTTP_METHODS.has(method)) throw new Error(`Unsupported HTTP method '${input.method}'.`);
  const operation = input.document.paths[input.path]?.[method] as OpenApiOperation | undefined;
  if (!operation) throw new Error(`OpenAPI operation not found: ${method.toUpperCase()} ${input.path}`);
  const response = operation.responses?.[String(input.status)] ?? operation.responses?.default;
  if (!response) return { ok: false, method: method.toUpperCase(), path: input.path, status: input.status, contentType: input.contentType ?? 'application/json', violations: [{ path: '$response', rule: 'status', message: `Status ${input.status} is not declared by the OpenAPI operation.` }] };
  const contentType = normalizeContentType(input.contentType ?? 'application/json');
  if (input.contentType && !response.content?.[contentType]) {
    return { ok: false, method: method.toUpperCase(), path: input.path, status: input.status, contentType, violations: [{ path: '$response.contentType', rule: 'contentType', message: `Content type '${contentType}' is not declared by the OpenAPI response.` }] };
  }
  const schema = response.content?.[contentType]?.schema ?? (!input.contentType ? fallbackJsonSchema(response.content) : undefined);
  if (!schema) return { ok: true, method: method.toUpperCase(), path: input.path, status: input.status, contentType, violations: [] };
  const violations = validateSchemaValue(input.document, schema, input.body);
  return { ok: violations.length === 0, method: method.toUpperCase(), path: input.path, status: input.status, contentType, violations };
}

function normalizeContentType(value: string): string { return value.split(';', 1)[0]!.trim().toLowerCase(); }
function fallbackJsonSchema(content: Record<string, { schema?: OpenApiSchema }> | undefined): OpenApiSchema | undefined {
  if (!content) return undefined;
  return Object.entries(content).find(([type]) => type.includes('json'))?.[1].schema;
}
