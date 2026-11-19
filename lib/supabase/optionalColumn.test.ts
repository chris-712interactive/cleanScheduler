import { describe, expect, it } from 'vitest';
import {
  isMissingColumnError,
  queryWithOptionalColumn,
  selectWithoutColumn,
} from '@/lib/supabase/optionalColumn';

const selectSql = `
  id,
  route_sequence,
  customers (
    route_sequence_note
  )
`;

describe('optional route_sequence column', () => {
  it('recognizes Postgres 42703 and the PostgREST schema-cache code', () => {
    expect(
      isMissingColumnError(
        {
          code: '42703',
          message: 'column tenant_scheduled_visits.route_sequence does not exist',
        },
        'route_sequence',
      ),
    ).toBe(true);
    expect(
      isMissingColumnError(
        {
          code: 'PGRST204',
          message:
            "Could not find the 'route_sequence' column of 'tenant_scheduled_visits' in the schema cache",
        },
        'route_sequence',
      ),
    ).toBe(true);
    expect(
      isMissingColumnError(
        { code: '42703', message: 'column tenant_scheduled_visits.title does not exist' },
        'route_sequence',
      ),
    ).toBe(false);
    expect(
      isMissingColumnError({ code: '23514', message: 'route_sequence' }, 'route_sequence'),
    ).toBe(false);
  });

  it('removes only the requested column from a select list', () => {
    const next = selectWithoutColumn(selectSql, 'route_sequence');
    expect(next).not.toMatch(/\broute_sequence\b/);
    expect(next).toContain('route_sequence_note');
    expect(next).toContain('id');
  });

  it('retries without the column and treats the value as null', async () => {
    const selects: string[] = [];
    const result = await queryWithOptionalColumn<{ id: string; route_sequence?: number | null }>({
      column: 'route_sequence',
      select: selectSql,
      run: async (sql) => {
        selects.push(sql);
        if (sql.includes('route_sequence,') || /\broute_sequence\b/.test(sql)) {
          return {
            data: null,
            error: {
              code: '42703',
              message: 'column tenant_scheduled_visits.route_sequence does not exist',
            },
          };
        }
        return { data: [{ id: 'visit-1' }], error: null };
      },
    });
    expect(selects).toHaveLength(2);
    expect(selects[1]).not.toMatch(/\broute_sequence\b/);
    expect(result.columnAvailable).toBe(false);
    expect(result.rows).toEqual([{ id: 'visit-1', route_sequence: null }]);
  });

  it('does not retry an unrelated database error', async () => {
    await expect(
      queryWithOptionalColumn({
        column: 'route_sequence',
        select: selectSql,
        run: async () => ({ data: null, error: { code: '08006', message: 'db down' } }),
      }),
    ).rejects.toThrow('db down');
  });
});
