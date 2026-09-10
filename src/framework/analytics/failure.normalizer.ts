/**
 * Author: Raushan Raj
 * Business Use: Normalizes volatile error text before deterministic failure clustering.
 * How to use: failure.clusterer.ts calls normalizeFailureSignature for each final failed test.
 * Benefit: 100 failures caused by one service outage become one meaningful cluster instead of 100 noisy rows.
 */
export function normalizeFailureSignature(value = ''): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\/[^\s)]+/g, '<url>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\b\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}:\d{2}(?:\.\d+)?z?\b/gi, '<timestamp>')
    .replace(/\/users\/[^/\s]+/gi, '/users/<user>')
    .replace(/\/var\/folders\/[^\s]+|\/tmp\/[^\s]+|[a-z]:\\[^\s]+/gi, '<path>')
    .replace(/\b\d+(?:\.\d+)?\s*(?:ms|s|seconds?|minutes?)\b/gi, '<duration>')
    .replace(/\b\d{2,}\b/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}
