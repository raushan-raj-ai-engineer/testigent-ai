import { sanitizeText } from '../logging/redactor.js';
/**
 * Normalizes volatile failure text while retaining business-relevant endpoint/status semantics.
 */
export function normalizeFailureText(value = ''): string {
  return sanitizeText(value, { redactPii: true })
    .toLowerCase()
    .replace(/https?:\/\/[^\s)]+/g, '<url>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\b\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}:\d{2}(?:\.\d+)?z?\b/gi, '<timestamp>')
    .replace(/\b(?:request|trace|correlation|session)[-_ ]?id\s*[:=]\s*[a-z0-9._-]+/gi, 'request-id=<id>')
    .replace(/\/(users|orders|customers|accounts|payments)\/\d+\b/gi, '/$1/<id>')
    .replace(/\/(users|orders|customers|accounts|payments)\/[0-9a-f-]{8,}\b/gi, '/$1/<id>')
    .replace(/\/var\/folders\/[^\s]+|\/tmp\/[^\s]+|[a-z]:\\[^\s]+/gi, '<path>')
    .replace(/\b\d+(?:\.\d+)?\s*(?:ms|s|seconds?|minutes?)\b/gi, '<duration>')
    .replace(/\bport\s+\d{2,5}\b/gi, 'port <port>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

/** Normalizes an API endpoint without erasing the operation shape used for triage correlation. */
export function normalizeEndpoint(value = ''): string {
  return sanitizeText(value, { redactPii: true })
    .trim()
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/\/(users|orders|customers|accounts|payments)\/\d+\b/gi, '/$1/<id>')
    .replace(/\/(users|orders|customers|accounts|payments)\/[0-9a-f-]{8,}\b/gi, '/$1/<id>')
    .replace(/\?.*$/, '')
    .slice(0, 240);
}
