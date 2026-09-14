import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadOpenApiDocument } from '../../src/framework/api-contract/openapi-loader.js';
import { validateResponseContract } from '../../src/framework/api-contract/response-contract-validator.js';
import { detectBreakingChanges } from '../../src/framework/api-contract/breaking-change-detector.js';
import type { OpenApiDocument, OpenApiOperation, OpenApiSchema } from '../../src/framework/api-contract/openapi.types.js';

test.describe('API contract intelligence', () => {
  test('loads OpenAPI 3 JSON/YAML and validates declared response schemas', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-openapi-'));
    try {
      const json = path.join(dir, 'api.json');
      fs.writeFileSync(json, JSON.stringify(baseline(), null, 2));
      const document = loadOpenApiDocument(json);
      expect(validateResponseContract({ document, method: 'GET', path: '/users/{id}', status: 200, body: { id: 7, name: 'Rohit' } }).ok).toBe(true);
      const invalid = validateResponseContract({ document, method: 'GET', path: '/users/{id}', status: 200, body: { id: '7' } });
      expect(invalid.ok).toBe(false);
      expect(invalid.violations.map(item => item.rule)).toContain('type');
      expect(invalid.violations.map(item => item.rule)).toContain('required');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('detects removed operations, stricter requests, response guarantee loss and type changes', () => {
    const previous = baseline();
    const current = structuredClone(previous);
    const operation = current.paths['/users/{id}']!.get as OpenApiOperation;
    operation.requestBody = { required: true, content: { 'application/json': { schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } } } } };
    const responseSchema = operation.responses?.['200']?.content?.['application/json']?.schema as OpenApiSchema;
    if (!responseSchema.properties) throw new Error('Expected response properties in fixture.');
    responseSchema.required = ['id'];
    responseSchema.properties.id = { type: 'string' };
    const changes = detectBreakingChanges(previous, current);
    expect(changes.some(item => item.kind === 'REQUEST_BODY_REQUIRED')).toBe(true);
    expect(changes.some(item => item.kind === 'REQUEST_REQUIRED_ADDED')).toBe(true);
    expect(changes.some(item => item.kind === 'RESPONSE_REQUIRED_REMOVED')).toBe(true);
    expect(changes.some(item => item.kind === 'SCHEMA_TYPE_CHANGED')).toBe(true);
  });


  test('rejects an undeclared response content type instead of silently falling back to JSON', () => {
    const result = validateResponseContract({ document: baseline(), method: 'GET', path: '/users/{id}', status: 200, body: { id: 7, name: 'Rohit' }, contentType: 'text/plain; charset=utf-8' });
    expect(result.ok).toBe(false);
    expect(result.violations[0]?.rule).toBe('contentType');
  });

  test('explicit content type fails closed when the response declares no content', () => {
    const document = baseline();
    const operation = document.paths['/users/{id}']!.get as OpenApiOperation;
    operation.responses = { '204': { description: 'No content' } };
    const result = validateResponseContract({ document, method: 'GET', path: '/users/{id}', status: 204, body: null, contentType: 'application/json' });
    expect(result.ok).toBe(false);
    expect(result.violations[0]?.rule).toBe('contentType');
  });

  test('missing declared status fails closed', () => {
    const result = validateResponseContract({ document: baseline(), method: 'GET', path: '/users/{id}', status: 500, body: { error: 'boom' } });
    expect(result.ok).toBe(false);
    expect(result.violations[0]?.rule).toBe('status');
  });


  test('detects removed response media types and newly introduced response enum values', () => {
    const previous = baseline();
    const previousOperation = previous.paths['/users/{id}']!.get as OpenApiOperation;
    const previousResponse = previousOperation.responses?.['200'];
    if (!previousResponse?.content) throw new Error('Expected response content in fixture.');
    previousResponse.content['application/problem+json'] = { schema: { type: 'object', properties: { code: { type: 'string' } } } };
    const previousSchema = previousResponse.content['application/json']?.schema as OpenApiSchema;
    if (!previousSchema.properties) throw new Error('Expected response properties in fixture.');
    previousSchema.properties.name = { type: 'string', enum: ['Rohit'] };

    const current = structuredClone(previous);
    const currentOperation = current.paths['/users/{id}']!.get as OpenApiOperation;
    const currentResponse = currentOperation.responses?.['200'];
    if (!currentResponse?.content) throw new Error('Expected response content in fixture.');
    delete currentResponse.content['application/problem+json'];
    const currentSchema = currentResponse.content['application/json']?.schema as OpenApiSchema;
    if (!currentSchema.properties) throw new Error('Expected response properties in fixture.');
    currentSchema.properties.name = { type: 'string', enum: ['Rohit', 'Guest'] };

    const changes = detectBreakingChanges(previous, current);
    expect(changes.some(item => item.kind === 'RESPONSE_CONTENT_TYPE_REMOVED')).toBe(true);
    expect(changes.some(item => item.kind === 'RESPONSE_ENUM_VALUE_ADDED')).toBe(true);
  });

  test('circular alias references fail closed with a bounded diagnostic', () => {
    const document = baseline();
    document.components = { schemas: { A: { $ref: '#/components/schemas/B' }, B: { $ref: '#/components/schemas/A' } } };
    const operation = document.paths['/users/{id}']!.get as OpenApiOperation;
    operation.responses = { '200': { description: 'Cycle', content: { 'application/json': { schema: { $ref: '#/components/schemas/A' } } } } };
    expect(() => validateResponseContract({ document, method: 'GET', path: '/users/{id}', status: 200, body: {} })).toThrow(/Circular OpenAPI schema reference/);
  });
});

function baseline(): OpenApiDocument {
  return {
    openapi: '3.0.3',
    info: { title: 'Users', version: '1.0.0' },
    paths: {
      '/users/{id}': {
        get: {
          responses: {
            '200': {
              description: 'User',
              content: {
                'application/json': {
                  schema: {
                    type: 'object', required: ['id', 'name'], additionalProperties: false,
                    properties: { id: { type: 'integer' }, name: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}
