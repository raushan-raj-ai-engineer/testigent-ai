/**
 * Spreadsheet-safe CSV cell. Machine-readable JSON retains exact source values; human-facing CSV neutralizes
 * values that Excel/Calc-class viewers may interpret as formulas. The apostrophe is intentionally part of the
 * cell text before RFC-4180 quoting.
 */
export function spreadsheetSafeCsvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[\t\r]/.test(text) || /^\s*[=+\-@]/.test(text)) text = `\'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
