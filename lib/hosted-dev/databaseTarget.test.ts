import { describe, expect, it } from 'vitest';
import { assertDevDatabaseUrl } from '@/lib/hosted-dev/databaseTarget';

describe('dev database URL guard', () => {
  it('accepts the dev project direct host and pooler user', () => {
    expect(
      assertDevDatabaseUrl(
        'postgresql://postgres:secret@db.devproject.supabase.co:5432/postgres?sslmode=require',
        'devproject.supabase.co',
      ).ok,
    ).toBe(true);
    expect(
      assertDevDatabaseUrl(
        'postgresql://postgres.devproject:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
        'devproject.supabase.co',
      ).ok,
    ).toBe(true);
  });

  it('rejects a different project, disabled TLS, and a missing identity host', () => {
    expect(
      assertDevDatabaseUrl(
        'postgresql://postgres:secret@db.prodproject.supabase.co:5432/postgres',
        'devproject.supabase.co',
      ),
    ).toMatchObject({ ok: false });
    expect(
      assertDevDatabaseUrl(
        'postgresql://postgres.devproject:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=disable',
        'devproject.supabase.co',
      ),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/TLS/) });
    expect(
      assertDevDatabaseUrl('postgresql://postgres:secret@localhost/postgres', null),
    ).toMatchObject({ ok: false });
  });
});
