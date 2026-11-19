import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { utcInstantForZonedCivilTime } from './seed.mjs';
import {
  assertLocalDatabaseUrl,
  assertLocalStackEnv,
  libpqChildEnv,
  localStackPgPort,
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
    expect(() => assertLocalDatabaseUrl('postgresql://postgres@/cleanscheduler_qa')).toThrow(
      /loopback host/,
    );
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

  it('allows only sslmode, connect_timeout, and application_name', () => {
    const base = 'postgresql://postgres@127.0.0.1:54332/postgres';
    expect(() =>
      assertLocalDatabaseUrl(
        `${base}?sslmode=disable&connect_timeout=2&application_name=local-stack`,
      ),
    ).not.toThrow();
    expect(() => assertLocalDatabaseUrl(`${base}?SSLMODE=disable&Connect_Timeout=1`)).not.toThrow();
    for (const key of [
      'service',
      'SERVICE',
      'host',
      'HOST',
      'hostaddr',
      'HostAddr',
      'passfile',
      'options',
      'target_session_attrs',
      'unknown',
    ]) {
      expect(() => assertLocalDatabaseUrl(`${base}?${key}=evil`)).toThrow(
        new RegExp(`query parameter "${key.toLowerCase()}" is not allowed`),
      );
    }
    expect(() =>
      assertLocalDatabaseUrl('postgresql://db%2eexample%2esupabase%2eco/postgres'),
    ).toThrow(/hosted project/);
    expect(() => assertLocalDatabaseUrl('postgresql://postgres@/postgres')).toThrow(
      /loopback host/,
    );
  });
});

describe('libpq child environment', () => {
  it('drops every PG* variable and keeps the rest', () => {
    const env = libpqChildEnv({
      PATH: '/usr/bin',
      HOME: '/tmp',
      PGHOSTADDR: '192.0.2.1',
      PGHOST: '192.0.2.1',
      pgport: '1',
      PGPASSWORD: 'secret',
      PGSERVICE: 'remote',
      PGOPTIONS: '-c search_path=public',
      PGSERVICEFILE: '/home/user/.pg_service.conf',
      PGSYSCONFDIR: '/etc/postgresql',
    });
    expect(env.PATH).toBe('/usr/bin');
    expect(env.HOME).toBe('/tmp');
    expect(env.PGHOSTADDR).toBeUndefined();
    expect(env.PGHOST).toBeUndefined();
    expect(env.pgport).toBeUndefined();
    expect(env.PGPASSWORD).toBeUndefined();
    expect(env.PGSERVICE).toBeUndefined();
    expect(env.PGOPTIONS).toBeUndefined();
    expect(env.PGSERVICEFILE).toBe('/nonexistent/cleanscheduler-no-pg-service.conf');
    expect(env.PGSYSCONFDIR).toBe('/nonexistent/cleanscheduler-no-pg-sysconf');
  });

  it('does not give psql a parent PGHOSTADDR', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'cs-psql-'));
    const stub = path.join(dir, 'psql');
    writeFileSync(
      stub,
      `#!/usr/bin/env node
console.log('PGHOSTADDR=' + (process.env.PGHOSTADDR ?? ''));
console.log('PGHOST=' + (process.env.PGHOST ?? ''));
console.log('PGSERVICEFILE=' + (process.env.PGSERVICEFILE ?? ''));
process.exit(0);
`,
    );
    chmodSync(stub, 0o755);
    const result = spawnSync(process.execPath, ['scripts/check-rls-smoke.mjs'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH ?? ''}`,
        RLS_SMOKE_REQUIRED: '1',
        DATABASE_URL: 'postgresql://postgres@127.0.0.1:1/postgres',
        PGHOSTADDR: '192.0.2.1',
        PGHOST: '192.0.2.1',
        PGSERVICEFILE: '/home/user/.pg_service.conf',
      },
    });
    expect(result.stdout).toContain('PGHOSTADDR=\n');
    expect(result.stdout).toContain('PGHOST=\n');
    expect(result.stdout).toContain('PGSERVICEFILE=/nonexistent/cleanscheduler-no-pg-service.conf');
    expect(`${result.stdout}${result.stderr}`).not.toContain('192.0.2.1');
    expect(`${result.stdout}${result.stderr}`).not.toContain('/home/user/.pg_service.conf');
  });
});

describe('local stack postgres port', () => {
  it('accepts a plain port and rejects a URI fragment', () => {
    expect(localStackPgPort(undefined)).toBe('54332');
    expect(localStackPgPort('54332')).toBe('54332');
    expect(() => localStackPgPort('5432/db?host=192.0.2.1&connect_timeout=1')).toThrow(
      /integer port/,
    );
    expect(() => localStackPgPort('0')).toThrow(/integer port/);
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
