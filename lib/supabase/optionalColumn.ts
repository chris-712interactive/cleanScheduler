type QueryError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

/**
 * Postgres undefined_column is 42703. PostgREST also reports a missing column
 * as PGRST204 when the schema cache has not caught up.
 */
export function isMissingColumnError(
  error: QueryError | null | undefined,
  column: string,
): boolean {
  const name = column.trim().toLowerCase();
  if (!error || !name) return false;
  const text = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase();
  if (!text.includes(name)) return false;
  return error.code === '42703' || error.code === 'PGRST204' || text.includes('42703');
}

/** Drop one column from a PostgREST select string. Nested selects are left alone. */
export function selectWithoutColumn(selectSql: string, column: string): string {
  const name = column.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return selectSql;
  const without = selectSql
    .replace(new RegExp(`(^|[\\n,])\\s*${name}\\s*(?=,|\\n|$)`, 'g'), '$1')
    .replace(/,\s*,/g, ',')
    .replace(/\(\s*,/g, '(')
    .replace(/,\s*\)/g, ')');
  return without;
}

export async function queryWithOptionalColumn<T extends object>(params: {
  column: string;
  select: string;
  run: (selectSql: string) => PromiseLike<{ data: T[] | null; error: QueryError | null }>;
}): Promise<{ rows: T[]; columnAvailable: boolean }> {
  const first = await params.run(params.select);
  if (!first.error) {
    return { rows: first.data ?? [], columnAvailable: true };
  }
  if (!isMissingColumnError(first.error, params.column)) {
    throw new Error(first.error.message ?? 'Query failed.');
  }
  const fallbackSelect = selectWithoutColumn(params.select, params.column);
  const second = await params.run(fallbackSelect);
  if (second.error) {
    throw new Error(second.error.message ?? 'Query failed.');
  }
  return {
    rows: (second.data ?? []).map((row) => ({ ...row, [params.column]: null })),
    columnAvailable: false,
  };
}
