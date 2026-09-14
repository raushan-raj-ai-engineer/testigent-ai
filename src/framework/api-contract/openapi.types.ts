export type OpenApiSchemaType = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';

export interface OpenApiDocument {
  openapi: string;
  info?: { title?: string; version?: string };
  paths: Record<string, OpenApiPathItem>;
  components?: {
    schemas?: Record<string, OpenApiSchema>;
    parameters?: Record<string, OpenApiParameter>;
  };
}

export interface OpenApiPathItem {
  parameters?: OpenApiParameter[];
  [key: string]: OpenApiOperation | OpenApiParameter[] | unknown;
}

export interface OpenApiOperation {
  parameters?: OpenApiParameter[];
  requestBody?: { required?: boolean; content?: Record<string, { schema?: OpenApiSchema }> };
  responses?: Record<string, { description?: string; content?: Record<string, { schema?: OpenApiSchema }> }>;
}

export interface OpenApiParameter {
  $ref?: string;
  name?: string;
  in?: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  schema?: OpenApiSchema;
}

export interface OpenApiSchema {
  $ref?: string;
  type?: OpenApiSchemaType | OpenApiSchemaType[];
  nullable?: boolean;
  required?: string[];
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  enum?: unknown[];
  oneOf?: OpenApiSchema[];
  allOf?: OpenApiSchema[];
  anyOf?: OpenApiSchema[];
  additionalProperties?: boolean | OpenApiSchema;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number | boolean;
  exclusiveMaximum?: number | boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  minProperties?: number;
  maxProperties?: number;
  format?: string;
  description?: string;
  default?: unknown;
  example?: unknown;
  examples?: unknown[];
  deprecated?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  title?: string;
  [key: string]: unknown;
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
  | 'RESPONSE_ENUM_VALUE_ADDED'
  | 'REQUIRED_PARAMETER_ADDED'
  | 'PARAMETER_REMOVED';

export interface BreakingChange {
  kind: BreakingChangeKind;
  location: string;
  message: string;
}
