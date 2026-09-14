export interface RewrittenSql { sql: string; count: number; }

interface ScanOptions { preservePostgresJsonOperators?: boolean; collectPostgresNative?: boolean; preserveSqlServerBracketIdentifiers?: boolean; }
interface ScanResult extends RewrittenSql { nativeIndexes: number[]; }

/**
 * Rewrites repository '?' placeholders without touching literals, quoted identifiers, SQL Server bracket identifiers,
 * comments, PostgreSQL dollar-quoted bodies, or PostgreSQL JSON existence operators.
 */
export function rewriteQuestionMarkParameters(
  input: string,
  replacement: (index: number) => string,
  options: { preservePostgresJsonOperators?: boolean; preserveSqlServerBracketIdentifiers?: boolean } = {},
): RewrittenSql {
  const result = scanSql(input, replacement, options);
  return { sql: result.sql, count: result.count };
}

/**
 * Prepares SQL for node-postgres. Native $1/$2 placeholders are supported unchanged; repository '?' placeholders
 * are rewritten to $n. Mixing both placeholder styles is rejected because it is ambiguous and error-prone.
 */
export function preparePostgresSql(input: string, parameterCount: number): RewrittenSql {
  const result = scanSql(input, index => `$${index + 1}`, { preservePostgresJsonOperators: true, collectPostgresNative: true });
  const native = [...new Set(result.nativeIndexes)].sort((a, b) => a - b);
  if (native.length && result.count) throw new Error('SQL_PARAMETER_STYLE: do not mix PostgreSQL native $n parameters with repository ? placeholders.');
  if (native.length) {
    const max = native.at(-1)!;
    for (let index = 1; index <= max; index += 1) if (!native.includes(index)) throw new Error(`SQL_PARAMETER_SEQUENCE: PostgreSQL parameters must be contiguous from $1; missing $${index}.`);
    if (max !== parameterCount) throw new Error(`SQL_PARAMETER_COUNT: expected ${max} value(s), received ${parameterCount}.`);
    return { sql: input, count: max };
  }
  if (result.count !== parameterCount) throw new Error(`SQL_PARAMETER_COUNT: expected ${result.count} value(s), received ${parameterCount}.`);
  return { sql: result.sql, count: result.count };
}

function scanSql(input: string, replacement: (index: number) => string, options: ScanOptions): ScanResult {
  let output = '';
  let count = 0;
  let index = 0;
  let state: 'code' | 'single' | 'double' | 'backtick' | 'bracket' | 'line-comment' | 'block-comment' | 'dollar' = 'code';
  let dollarTag = '';
  const nativeIndexes: number[] = [];

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
    if (state === 'bracket') {
      output += char;
      if (char === ']' && next === ']') { output += next; index += 2; continue; }
      if (char === ']') state = 'code';
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
    if (char === '[' && options.preserveSqlServerBracketIdentifiers) { state = 'bracket'; output += char; index += 1; continue; }
    if (char === '-' && next === '-') { state = 'line-comment'; output += '--'; index += 2; continue; }
    if (char === '/' && next === '*') { state = 'block-comment'; output += '/*'; index += 2; continue; }
    if (char === '$') {
      const dollar = input.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (dollar) { dollarTag = dollar[0]; state = 'dollar'; output += dollarTag; index += dollarTag.length; continue; }
      if (options.collectPostgresNative) {
        const positional = input.slice(index).match(/^\$([1-9][0-9]*)/);
        if (positional) {
          nativeIndexes.push(Number(positional[1])); output += positional[0]; index += positional[0].length; continue;
        }
      }
    }

    if (char === '?') {
      if (options.preservePostgresJsonOperators && isPostgresJsonOperator(input, index)) {
        output += char; index += 1; continue;
      }
      output += replacement(count); count += 1; index += 1; continue;
    }

    output += char; index += 1;
  }

  return { sql: output, count, nativeIndexes };
}

const NON_EXPRESSION_KEYWORDS = new Set([
  'SELECT','FROM','WHERE','AND','OR','NOT','ON','AS','SET','VALUES','VALUE','RETURNING','WHEN','THEN','ELSE','CASE','BY',
  'ORDER','GROUP','LIMIT','OFFSET','IN','IS','LIKE','ILIKE','BETWEEN','JOIN','LEFT','RIGHT','FULL','INNER','OUTER','CROSS',
  'UPDATE','INSERT','INTO','DELETE','HAVING','DISTINCT','UNION','INTERSECT','EXCEPT','OVER','PARTITION','FILTER','WITH',
]);

function isPostgresJsonOperator(sql: string, index: number): boolean {
  const next = sql[index + 1] ?? '';
  if (next === '|' || next === '&') return true;
  if (!hasExpressionOnLeft(sql, index)) return false;
  return hasExpressionOnRight(sql, index);
}

function hasExpressionOnLeft(sql: string, index: number): boolean {
  let cursor = index - 1;
  while (cursor >= 0 && /\s/.test(sql[cursor]!)) cursor -= 1;
  if (cursor < 0) return false;
  const char = sql[cursor]!;
  if (/[)\]}'"`0-9]/.test(char)) return true;
  if (!/[A-Za-z_$]/.test(char)) return false;
  const end = cursor + 1;
  while (cursor >= 0 && /[A-Za-z0-9_$]/.test(sql[cursor]!)) cursor -= 1;
  const token = sql.slice(cursor + 1, end).toUpperCase();
  return token.length > 0 && !NON_EXPRESSION_KEYWORDS.has(token);
}

function hasExpressionOnRight(sql: string, index: number): boolean {
  let cursor = index + 1;
  while (cursor < sql.length && /\s/.test(sql[cursor]!)) cursor += 1;
  if (cursor >= sql.length) return false;
  const char = sql[cursor]!;
  if (char === '?') return true; // data ? ? : first ? is JSON operator, second ? is a bound value.
  if (/[('"`[$0-9]/.test(char)) return true;
  if (!/[A-Za-z_]/.test(char)) return false;
  const start = cursor;
  while (cursor < sql.length && /[A-Za-z0-9_$]/.test(sql[cursor]!)) cursor += 1;
  const token = sql.slice(start, cursor).toUpperCase();
  return token.length > 0 && !NON_EXPRESSION_KEYWORDS.has(token);
}
