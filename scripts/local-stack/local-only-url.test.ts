import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { utcInstantForZonedCivilTime } from './seed.mjs';
import {
  assertLocalDatabaseUrl,
  assertLocalStackEnv,
  LocalOnlyUrlError,
} from './local-only-url.mjs';

describe('local stack URL guard', () => {
  it('accepts the loopback API and database', () => {
    expect(() =>
      assertLocalStackEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
      }),
    ).not.toThrow();
    expect(() => assertLocalDatabaseUrl('postgresql://postgres@/cleanscheduler_qa')).not.toThrow();
  });

  it('refuses hosted projects and does not echo the password', () => {
    const secret = 'super-secret-db-password';
    const databaseUrl = `postgresql://postgres:${secret}@db.example.supabase.co:5432/postgres`;
    expect(() => assertLocalDatabaseUrl(databaseUrl)).toThrow(LocalOnlyUrlError);
    try {
      assertLocalDatabaseUrl(databaseUrl);
    } catch (error) {
      expect(error instanceof Error ? error.message : '').not.toContain(secret);
    }
    expect(() =>
      assertLocalStackEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      }),
    ).toThrow(/hosted project/);
    expect(() =>
      assertLocalStackEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'http://10.1.2.3:54321',
      }),
    ).toThrow(/not local/);
  });
});

describe('visit clock', () => {
  it('places 10:00 America/New_York in January at 15:00 UTC', () => {
    const instant = utcInstantForZonedCivilTime('America/New_York', 2026, 1, 15, 10, 0);
    expect(instant.toISOString()).toBe('2026-01-15T15:00:00.000Z');
  });
});

describe('check:rls-smoke required mode', () => {
  it('fails when a local-stack run has no database', () => {
    const env: NodeJS.ProcessEnv = { ...process.env, RLS_SMOKE_REQUIRED: '1' };
    delete env.DATABASE_URL;
    const result = spawnSync(process.execPath, ['scripts/check-rls-smoke.mjs'], {
      encoding: 'utf8',
      env,
    });
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain('DATABASE_URL is required');
  });

  it('still skips when DATABASE_URL is unset and the run is not required', () => {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.DATABASE_URL;
    delete env.RLS_SMOKE_REQUIRED;
    const result = spawnSync(process.execPath, ['scripts/check-rls-smoke.mjs'], {
      encoding: 'utf8',
      env,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('skipped');
  });

  it('refuses a hosted database url before opening it', () => {
    const result = spawnSync(process.execPath, ['scripts/check-rls-smoke.mjs'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        RLS_SMOKE_REQUIRED: '1',
        DATABASE_URL: 'postgresql://postgres:hidden-secret@db.example.supabase.co:5432/postgres',
      },
    });
    expect(result.status).toBe(1);
    const output = `${result.stdout}${result.stderr}`;
    expect(output).toContain('refused');
    expect(output).not.toContain('hidden-secret');
  });
});
