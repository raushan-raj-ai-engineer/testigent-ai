export interface RewrittenSql { sql: string; count: number; }

/**
 * Rewrites repository '?' placeholders while preserving question marks inside SQL literals/comments and PostgreSQL JSON operators.
 * This intentionally supports a bounded SQL lexical subset; ambiguous PostgreSQL '?' operators are preserved rather than rewritten.
 */
export function rewriteQuestionMarkParameters(
  input: string,
  replacement: (index: number) => string,
  options: { preservePostgresJsonOperators?: boolean } = {},
): RewrittenSql {
  let output = '';
  let count = 0;
  let index = 0;
  let state: 'code' | 'single' | 'double' | 'backtick' | 'line-comment' | 'block-comment' | 'dollar' = 'code';
  let dollarTag = '';

  while (index < input.length) {
    const char = input[index]!;
    const next = input[index + 1] ?? '';

    if (state === 'single') {
      output += char;
      if (char === "'" && next === "'") { output += next; index += 2; continue; }
      if (char === "'" && input[index - 1] !== '\\') state = 'code';
      index += 1; continue;
    }
    if (state === 'double') {
      output += char;
      if (char === '"' && next === '"') { output += next; index += 2; continue; }
      if (char === '"' && input[index - 1] !== '\\') state = 'code';
      index += 1; continue;
    }
    if (state === 'backtick') {
      output += char;
      if (char === '`' && next === '`') { output += next; index += 2; continue; }
      if (char === '`') state = 'code';
      index += 1; continue;
    }
    if (state === 'line-comment') {
      output += char;
      if (char === '\n') state = 'code';
      index += 1; continue;
    }
    if (state === 'block-comment') {
      output += char;
      if (char === '*' && next === '/') { output += '/'; index += 2; state = 'code'; continue; }
      index += 1; continue;
    }
    if (state === 'dollar') {
      if (dollarTag && input.startsWith(dollarTag, index)) {
        output += dollarTag; index += dollarTag.length; state = 'code'; dollarTag = ''; continue;
      }
      output += char; index += 1; continue;
    }

    if (char === "'") { state = 'single'; output += char; index += 1; continue; }
    if (char === '"') { state = 'double'; output += char; index += 1; continue; }
    if (char === '`') { state = 'backtick'; output += char; index += 1; continue; }
    if (char === '-' && next === '-') { state = 'line-comment'; output += '--'; index += 2; continue; }
    if (char === '/' && next === '*') { state = 'block-comment'; output += '/*'; index += 2; continue; }
    if (char === '$') {
      const match = input.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) { dollarTag = match[0]; state = 'dollar'; output += dollarTag; index += dollarTag.length; continue; }
    }

    if (char === '?') {
      if (options.preservePostgresJsonOperators && isPostgresJsonOperator(input, index)) {
        output += char; index += 1; continue;
      }
      output += replacement(count); count += 1; index += 1; continue;
    }

    output += char; index += 1;
  }

  return { sql: output, count };
}

function isPostgresJsonOperator(sql: string, index: number): boolean {
  const next = sql[index + 1] ?? '';
  if (next === '|' || next === '&') return true;
  const left = previousNonWhitespace(sql, index - 1);
  const right = nextNonWhitespace(sql, index + 1);
  // PostgreSQL's binary '?' JSON existence operator normally has an expression on the left
  // and a literal/identifier/expression on the right. Prefer preserving an ambiguous operator
  // over corrupting SQL; callers can use driver-native placeholders for ambiguous statements.
  return Boolean(left && right && /[A-Za-z0-9_\])"'`]/.test(left) && /[A-Za-z0-9_\[("'`$]/.test(right));
}
function previousNonWhitespace(sql: string, index: number): string { for (let i = index; i >= 0; i -= 1) if (!/\s/.test(sql[i]!)) return sql[i]!; return ''; }
function nextNonWhitespace(sql: string, index: number): string { for (let i = index; i < sql.length; i += 1) if (!/\s/.test(sql[i]!)) return sql[i]!; return ''; }
