const SECRET_KEYS = /password|passwd|passphrase|token|authorization|cookie|session|api[-_]?key|secret|client[-_]?secret|refresh[-_]?token|access[-_]?token|card|cvv|ssn/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const BASIC = /\bBasic\s+[A-Za-z0-9+/=]+/gi;
const CARD_LIKE = /\b(?:\d[ -]*?){13,19}\b/g;
const SECRET_ASSIGNMENT = /\b(password|passwd|passphrase|token|authorization|cookie|session|api[-_]?key|secret|client[-_]?secret|refresh[-_]?token|access[-_]?token|cvv|ssn)\b\s*([:=])\s*([^\s,;}&]+)/gi;
const JSON_SECRET_VALUE = /(["'](?:password|passwd|passphrase|token|authorization|cookie|session|api[-_]?key|secret|client[-_]?secret|refresh[-_]?token|access[-_]?token|cvv|ssn)["']\s*:\s*)["'][^"']*["']/gi;
const URL_IN_TEXT = /https?:\/\/[^\s"'<>]+/gi;

export interface RedactionOptions {
  redactPii?: boolean;
  extraPatterns?: RegExp[];
}

/**
 * Author: Raushan Raj
 * Business Use: Removes secrets and configurable PII from logs, reports, persisted evidence and AI payloads.
 * How to use: redact(value) for structured values; sanitizeText()/sanitizeUrl() at free-text and URL boundaries.
 * Benefit: One fail-safe sanitizer prevents different framework layers from drifting into weaker masking policies.
 */
export function redact<T>(value: T, options: RedactionOptions = {}): T {
  const seen = new WeakSet<object>();
  const visit = (input: unknown, keyHint?: string): unknown => {
    if (keyHint && SECRET_KEYS.test(keyHint)) return '[REDACTED]';
    if (typeof input === 'string') return sanitizeText(input, options);
    if (Array.isArray(input)) return input.map(item => visit(item));
    if (input && typeof input === 'object') {
      if (seen.has(input as object)) return '[Circular]';
      seen.add(input as object);
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>).map(([key, val]) => [key, visit(val, key)])
      );
    }
    return input;
  };
  return visit(value) as T;
}

/** Sanitizes a URL without transmitting or persisting credentials or sensitive query values. */
export function sanitizeUrl(value: string, options: RedactionOptions = {}): string {
  try {
    const parsed = new URL(value);
    if (parsed.username) parsed.username = '[REDACTED]';
    if (parsed.password) parsed.password = '[REDACTED]';

    // Query values can contain credentials/PII even when the parameter name itself looks harmless
    // (for example `returnTo=...?token=...` or `q=Bearer ...`). Sanitize both keys and values.
    for (const [key, raw] of [...parsed.searchParams.entries()]) {
      parsed.searchParams.set(
        key,
        SECRET_KEYS.test(key) ? '[REDACTED]' : sanitizeTextWithoutUrls(raw, options),
      );
    }
    parsed.pathname = sanitizeTextWithoutUrls(parsed.pathname, options);
    if (parsed.hash) {
      parsed.hash = SECRET_KEYS.test(parsed.hash)
        ? '#[REDACTED]'
        : `#${sanitizeTextWithoutUrls(parsed.hash.slice(1), options)}`;
    }
    return parsed.toString();
  } catch {
    return sanitizeTextWithoutUrls(value, options);
  }
}

/**
 * Sanitizes arbitrary free text. JSON strings are parsed and recursively redacted before being re-serialized,
 * so secrets embedded inside a serialized response body or accessibility snapshot are not missed.
 */
export function sanitizeText(value: string, options: RedactionOptions = {}): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return JSON.stringify(redact(parsed, options));
    } catch {
      // Not valid JSON; continue through the free-text sanitizer.
    }
  }

  let output = value.replace(URL_IN_TEXT, candidate => sanitizeUrl(candidate, options));
  output = sanitizeTextWithoutUrls(output, options);
  return output;
}

/** Truncates only after sanitization so secrets beyond the eventual evidence limit cannot survive preprocessing. */
export function sanitizeAndTruncate(value: string, maxChars: number, options: RedactionOptions = {}): string {
  return sanitizeText(value, options).slice(0, Math.max(0, maxChars));
}

function sanitizeTextWithoutUrls(value: string, options: RedactionOptions = {}): string {
  const redactPii = options.redactPii ?? (process.env.REDACTION_PII_MODE ?? 'standard').toLowerCase() !== 'off';
  let output = value
    .replace(BEARER, 'Bearer [REDACTED]')
    .replace(BASIC, 'Basic [REDACTED]')
    .replace(JWT, '[TOKEN_REDACTED]')
    .replace(JSON_SECRET_VALUE, '$1"[REDACTED]"')
    .replace(SECRET_ASSIGNMENT, '$1$2[REDACTED]');

  if (redactPii) {
    output = output
      .replace(EMAIL, '[EMAIL_REDACTED]')
      .replace(CARD_LIKE, '[NUMBER_REDACTED]');
  }

  for (const pattern of [...configuredExtraPatterns(), ...(options.extraPatterns ?? [])]) {
    output = output.replace(pattern, '[REDACTED]');
  }
  return output;
}

function configuredExtraPatterns(): RegExp[] {
  const raw = process.env.REDACTION_EXTRA_PATTERNS?.trim();
  if (!raw) return [];
  try {
    const values = JSON.parse(raw) as unknown;
    if (!Array.isArray(values)) return [];
    return values.flatMap(item => {
      if (typeof item !== 'string' || !item.trim()) return [];
      try { return [new RegExp(item, 'gi')]; } catch { return []; }
    });
  } catch {
    return [];
  }
}
