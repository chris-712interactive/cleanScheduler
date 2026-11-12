import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('user_profiles privileged column migration', () => {
  const sql = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/0124_user_profiles_privileged_columns.sql'),
    'utf8',
  );

  it('revokes table update and does not grant app_role back to authenticated', () => {
    expect(sql).toMatch(
      /revoke update, trigger on table public\.user_profiles from authenticated/i,
    );
    expect(sql).toMatch(/revoke update, trigger on table public\.user_profiles from anon/i);
    expect(sql).toMatch(/revoke update, trigger on table public\.user_profiles from public/i);
    const columnGrant = sql.match(
      /grant update \([^)]*\) on table public\.user_profiles to authenticated/i,
    );
    expect(columnGrant?.[0]).toBeTruthy();
    expect(columnGrant?.[0]).toContain('display_name');
    expect(columnGrant?.[0]).toContain('first_name');
    expect(columnGrant?.[0]).toContain('last_name');
    expect(columnGrant?.[0]).toContain('avatar_url');
    expect(columnGrant?.[0]).not.toContain('app_role');
    expect(columnGrant?.[0]).not.toContain('user_id');
    expect(columnGrant?.[0]).not.toContain('created_at');
  });

  it('rejects app_role changes from any role other than the server roles', () => {
    expect(sql).toContain('user_profiles_guard_privileged_columns');
    expect(sql).toMatch(/new\.app_role is distinct from old\.app_role/);
    expect(sql).toMatch(/current_user in \('service_role', 'postgres', 'supabase_admin'\)/);
    expect(sql).not.toMatch(/update public\.user_profiles/i);
  });
});
