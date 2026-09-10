const SECRET_KEYS = /password|passwd|token|authorization|cookie|api[-_]?key|secret|card|cvv/i;

/**
 * Author: Raushan Raj
 * Business Use: Removes secrets/PII-like fields before logs, reports or AI calls.
 * How to use: redact(value) before persisting or sending diagnostic payloads.
 * Benefit: Reduces accidental data leakage and supports enterprise governance.
 */
export function redact<T>(value: T): T {
  const seen = new WeakSet<object>();
  const visit = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(visit);
    if (input && typeof input === 'object') {
      if (seen.has(input as object)) return '[Circular]';
      seen.add(input as object);
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>).map(([key, val]) => [
          key,
          SECRET_KEYS.test(key) ? '[REDACTED]' : visit(val)
        ])
      );
    }
    return input;
  };
  return visit(value) as T;
}
