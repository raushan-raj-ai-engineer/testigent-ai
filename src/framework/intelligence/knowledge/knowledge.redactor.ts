/** Application-knowledge redaction and path normalization. Author: Raushan Raj */
import { redact } from '../../logging/redactor.js';

const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*\b/gi;
const LONG_SECRET = /\b[A-Za-z0-9_-]{32,}\b/g;
const CARD_LIKE = /\b(?:\d[ -]*?){12,19}\b/g;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_ID = /^\d{2,}$/;
const LONG_ID = /^[A-Za-z0-9_-]{20,}$/;

/**
 * Reusable framework function `redactKnowledgeText`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export function redactKnowledgeText(value: string): string {
  return value
    .replace(EMAIL, '[EMAIL_REDACTED]')
    .replace(JWT, '[TOKEN_REDACTED]')
    .replace(BEARER, 'Bearer [REDACTED]')
    .replace(CARD_LIKE, '[NUMBER_REDACTED]')
    .replace(LONG_SECRET, '[TOKEN_REDACTED]')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reusable framework function `sanitizeKnowledgeValue`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export function sanitizeKnowledgeValue<T>(value: T): T {
  const base = redact(value);
  const visit = (input: unknown): unknown => {
    if (typeof input === 'string') return redactKnowledgeText(input);
    if (Array.isArray(input)) return input.map(visit);
    if (input && typeof input === 'object') {
      return Object.fromEntries(Object.entries(input as Record<string, unknown>).map(([key, val]) => [key, visit(val)]));
    }
    return input;
  };
  return visit(base) as T;
}

/**
 * Reusable framework function `normalizeRoutePath`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export function normalizeRoutePath(pathname: string): string {
  const normalized = pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';
  const parts = normalized.split('/').map(part => {
    if (!part) return part;
    if (UUID.test(part) || NUMERIC_ID.test(part) || LONG_ID.test(part)) return ':id';
    return part;
  });
  return parts.join('/') || '/';
}

/**
 * Reusable framework function `safeVisibleText`.
 * Business Use: Centralizes shared TestigentAI behavior so project teams do not duplicate framework logic.
 * Benefit: Keeps behavior consistent, reviewable and reusable across organizations and applications.
 */
export function safeVisibleText(values: string[], limit = 40): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = redactKnowledgeText(raw).slice(0, 180);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}
