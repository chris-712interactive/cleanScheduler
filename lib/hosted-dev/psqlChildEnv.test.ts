import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { psqlChildEnv } from '@/lib/hosted-dev/psqlChildEnv';

const DATABASE_URL =
  'postgresql://postgres.khodybakkdpheqkoycgi:url-password@db.khodybakkdpheqkoycgi.supabase.co:5432/postgres?sslmode=require';

describe('psql child environment', () => {
  it('strips PGHOSTADDR, PGSERVICE, and other inherited PG* names', () => {
    const child = psqlChildEnv(
      {
        NODE_ENV: 'test',
        PATH: '/usr/bin',
        NOT_A_PG_VAR: 'keep',
        PGHOSTADDR: '203.0.113.10',
        pghostaddr: '203.0.113.9',
        PGSERVICE: 'prod',
        PGSERVICEFILE: '/tmp/pg_service.conf',
        PGHOST: 'db.other.supabase.co',
        PGPORT: '1',
        PGDATABASE: 'other',
        PGUSER: 'inherited-user',
        PGPASSWORD: 'inherited-password',
        PGPASSFILE: '/tmp/pgpass',
        PGOPTIONS: '-c role=bypass',
        PGSSLMODE: 'disable',
        PGCONNECT_TIMEOUT: '1',
        PGAPPNAME: 'inherited',
        PGSSLROOTCERT: '/tmp/ca.pem',
        PGREQUIRESSL: '0',
      },
      DATABASE_URL,
    );

    expect(child.PGHOSTADDR).toBeUndefined();
    expect(child.pghostaddr).toBeUndefined();
    expect(child.PGSERVICE).toBeUndefined();
    expect(child.PGSERVICEFILE).toBeUndefined();
    expect(child.PGPASSFILE).toBeUndefined();
    expect(child.PGOPTIONS).toBeUndefined();
    expect(child.PGCONNECT_TIMEOUT).toBeUndefined();
    expect(child.PGAPPNAME).toBeUndefined();
    expect(child.PGSSLROOTCERT).toBeUndefined();
    expect(child.PGREQUIRESSL).toBeUndefined();
    expect(child.PGHOST).toBe('db.khodybakkdpheqkoycgi.supabase.co');
    expect(child.PGPORT).toBe('5432');
    expect(child.PGUSER).toBe('postgres.khodybakkdpheqkoycgi');
    expect(child.PGPASSWORD).toBe('url-password');
    expect(child.PGDATABASE).toBe('postgres');
    expect(child.PGSSLMODE).toBe('require');
    expect(child.NODE_ENV).toBe('test');
    expect(child.PATH).toBe('/usr/bin');
    expect(child.NOT_A_PG_VAR).toBe('keep');
    expect(
      Object.keys(child)
        .filter((key) => key.toUpperCase().startsWith('PG'))
        .sort(),
    ).toEqual(['PGDATABASE', 'PGHOST', 'PGPASSWORD', 'PGPORT', 'PGSSLMODE', 'PGUSER']);
  });

  it('keeps a normal environment on the URL host and does not invent a connect timeout', () => {
    const child = psqlChildEnv(
      { NODE_ENV: 'test', PATH: '/usr/bin' },
      'postgresql://postgres:secret@db.khodybakkdpheqkoycgi.supabase.co/postgres',
    );

    expect(child.NODE_ENV).toBe('test');
    expect(child.PATH).toBe('/usr/bin');
    expect(child.PGHOST).toBe('db.khodybakkdpheqkoycgi.supabase.co');
    expect(child.PGPORT).toBe('5432');
    expect(child.PGUSER).toBe('postgres');
    expect(child.PGPASSWORD).toBe('secret');
    expect(child.PGDATABASE).toBe('postgres');
    expect(child.PGSSLMODE).toBe('require');
    expect(child.PGHOSTADDR).toBeUndefined();
    expect(child.PGSERVICE).toBeUndefined();
    expect(child.PGCONNECT_TIMEOUT).toBeUndefined();
  });

  it('is what the direct SQL RLS test passes to psql', () => {
    const source = readFileSync('tests/hosted-dev/isolated.spec.ts', 'utf8');
    expect(source).toContain('psqlChildEnv(process.env, databaseUrl)');
    expect(source).not.toContain('...process.env');
  });
});
