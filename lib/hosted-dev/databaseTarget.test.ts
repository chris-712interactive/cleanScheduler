import { describe, expect, it } from 'vitest';
import { assertDevDatabaseUrl } from '@/lib/hosted-dev/databaseTarget';

const DEV_HOST = 'khodybakkdpheqkoycgi.supabase.co';

describe('dev database URL guard', () => {
  it('accepts the dev project direct host and pooler user', () => {
    expect(
      assertDevDatabaseUrl(
        'postgresql://postgres:secret@db.khodybakkdpheqkoycgi.supabase.co:5432/postgres?sslmode=require',
        DEV_HOST,
      ).ok,
    ).toBe(true);
    expect(
      assertDevDatabaseUrl(
        'postgresql://postgres.khodybakkdpheqkoycgi:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
        DEV_HOST,
      ).ok,
    ).toBe(true);
  });

  it('rejects a different project, a non-dev identity, disabled TLS, and a missing identity host', () => {
    expect(
      assertDevDatabaseUrl(
        'postgresql://postgres:secret@db.prodproject.supabase.co:5432/postgres',
        DEV_HOST,
      ),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/hosted dev Supabase project/) });
    expect(
      assertDevDatabaseUrl(
        'postgresql://postgres:secret@db.khodybakkdpheqkoycgi.supabase.co:5432/postgres',
        'otherproject.supabase.co',
      ),
    ).toMatchObject({
      ok: false,
      reason: 'Deployment identity is not the hosted dev Supabase project.',
    });
    expect(
      assertDevDatabaseUrl(
        'postgresql://postgres.khodybakkdpheqkoycgi:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=disable',
        DEV_HOST,
      ),
    ).toMatchObject({ ok: false, reason: expect.stringMatching(/TLS/) });
    expect(
      assertDevDatabaseUrl('postgresql://postgres:secret@localhost/postgres', null),
    ).toMatchObject({ ok: false });
  });
});
