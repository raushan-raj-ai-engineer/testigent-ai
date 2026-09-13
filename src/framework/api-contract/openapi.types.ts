export interface OpenApiDocument {
  openapi: string;
  info?: { title?: string; version?: string };
  paths: Record<string, Record<string, OpenApiOperation | unknown>>;
  components?: { schemas?: Record<string, OpenApiSchema> };
}

export interface OpenApiOperation {
  requestBody?: { required?: boolean; content?: Record<string, { schema?: OpenApiSchema }> };
  responses?: Record<string, { description?: string; content?: Record<string, { schema?: OpenApiSchema }> }>;
}

export interface OpenApiSchema {
  $ref?: string;
  type?: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
  nullable?: boolean;
  required?: string[];
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  enum?: unknown[];
  oneOf?: OpenApiSchema[];
  allOf?: OpenApiSchema[];
  anyOf?: OpenApiSchema[];
  additionalProperties?: boolean | OpenApiSchema;
}

export interface SchemaViolation {
  path: string;
  rule: string;
  message: string;
}

export interface ResponseContractResult {
  ok: boolean;
  method: string;
  path: string;
  status: number;
  contentType: string;
  violations: SchemaViolation[];
}

export type BreakingChangeKind =
  | 'PATH_REMOVED'
  | 'METHOD_REMOVED'
  | 'RESPONSE_REMOVED'
  | 'RESPONSE_CONTENT_TYPE_REMOVED'
  | 'REQUEST_CONTENT_TYPE_REMOVED'
  | 'REQUEST_BODY_REQUIRED'
  | 'REQUEST_REQUIRED_ADDED'
  | 'RESPONSE_REQUIRED_REMOVED'
  | 'SCHEMA_TYPE_CHANGED'
  | 'ENUM_VALUE_REMOVED'
  | 'RESPONSE_ENUM_VALUE_ADDED';

export interface BreakingChange {
  kind: BreakingChangeKind;
  location: string;
  message: string;
}
