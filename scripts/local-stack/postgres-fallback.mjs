/**
 * No-Docker path: a loopback Postgres cluster, every migration, then the RLS SQL.
 * Auth and Storage are stubbed enough for the migrations and the RLS files.
 * GoTrue is not started, so password sign-in and the backfill API are not run.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { libpqChildEnv, localStackPgPort } from './local-only-url.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const dataDir = path.join(repoRoot, '.local-stack/pgdata');
const logFile = path.join(repoRoot, '.local-stack/postgres.log');
const stampFile = path.join(repoRoot, '.local-stack/migration-stamp.txt');
const port = localStackPgPort(process.env.LOCAL_STACK_PG_PORT);
const databaseUrl = `postgresql://postgres@127.0.0.1:${port}/cleanscheduler_qa`;

function findBin(name) {
  const which = spawnSync('bash', ['-lc', `command -v ${name}`], { encoding: 'utf8' });
  const fromPath = which.stdout?.trim();
  if (which.status === 0 && fromPath) return fromPath;
  const root = '/usr/lib/postgresql';
  if (!existsSync(root)) return null;
  for (const version of readdirSync(root)) {
    const candidate = path.join(root, version, 'bin', name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function run(bin, args, options = {}) {
  const result = spawnSync(bin, args, {
    stdio: 'inherit',
    ...options,
    env: libpqChildEnv(options.env ?? process.env),
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
}

function psql(args, options = {}) {
  const bin = findBin('psql');
  if (!bin) {
    console.error('psql is not installed. Install the PostgreSQL client and server packages.');
    process.exit(1);
  }
  run(bin, [databaseUrl, '-v', 'ON_ERROR_STOP=1', ...args], options);
}

function pgCronAvailable() {
  const bin = findBin('psql');
  const result = spawnSync(
    bin,
    [
      databaseUrl,
      '-tA',
      '-c',
      "select count(*) from pg_available_extensions where name = 'pg_cron'",
    ],
    { encoding: 'utf8', env: libpqChildEnv(process.env) },
  );
  return (result.stdout ?? '').trim() === '1';
}

export function migrationFiles() {
  return readdirSync(path.join(repoRoot, 'supabase/migrations'))
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

export function startPlainPostgres() {
  mkdirSync(path.dirname(dataDir), { recursive: true });
  const initdb = findBin('initdb');
  const pgCtl = findBin('pg_ctl');
  if (!initdb || !pgCtl || !findBin('psql')) {
    console.error(
      'Plain Postgres is not installed. Install postgresql, postgresql-contrib, and the client, or install Docker and rerun npm run test:local-stack.',
    );
    process.exit(1);
  }

  const stamp = migrationFiles().join('\n');
  const previous = existsSync(stampFile) ? readFileSync(stampFile, 'utf8') : '';
  if (existsSync(dataDir) && previous !== stamp) {
    spawnSync(pgCtl, ['-D', dataDir, 'stop', '-m', 'fast'], {
      stdio: 'ignore',
      env: libpqChildEnv(process.env),
    });
    spawnSync('rm', ['-rf', dataDir], { stdio: 'inherit' });
  }

  if (!existsSync(path.join(dataDir, 'PG_VERSION'))) {
    run(initdb, ['-D', dataDir, '--username=postgres', '--auth=trust', '--no-instructions']);
  }

  const ready = spawnSync(
    findBin('pg_isready') ?? 'pg_isready',
    ['-h', '127.0.0.1', '-p', port, '-d', 'postgres'],
    { env: libpqChildEnv(process.env) },
  );
  if ((ready.status ?? 1) !== 0) {
    run(pgCtl, ['-D', dataDir, '-l', logFile, '-o', `-p ${port} -k ${dataDir}`, 'start']);
  }

  const exists = spawnSync(
    findBin('psql'),
    [
      'postgresql://postgres@127.0.0.1:' + port + '/postgres',
      '-tA',
      '-c',
      "select 1 from pg_database where datname = 'cleanscheduler_qa'",
    ],
    { encoding: 'utf8', env: libpqChildEnv(process.env) },
  );
  if (!exists.stdout?.includes('1')) {
    run(findBin('psql'), [
      `postgresql://postgres@127.0.0.1:${port}/postgres`,
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      'create database cleanscheduler_qa',
    ]);
  }

  if (existsSync(stampFile) && readFileSync(stampFile, 'utf8') === stamp) {
    console.log('plain postgres migrations already applied');
  } else {
    psql(['-f', path.join(__dirname, 'bootstrap-plain-postgres.sql')]);
    const cron = pgCronAvailable();
    if (!cron) {
      console.log('pg_cron extension is not installed; migration 0021 uses the local shim');
    }
    for (const file of migrationFiles()) {
      const full = path.join(repoRoot, 'supabase/migrations', file);
      if (file.startsWith('0021_') && !cron) {
        psql(['-f', path.join(__dirname, 'pg-cron-shim.sql')]);
        continue;
      }
      psql(['-f', full]);
    }
    writeFileSync(stampFile, stamp);
    console.log(`plain postgres applied ${migrationFiles().length} migrations`);
  }

  return databaseUrl;
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entry.endsWith(`${path.sep}postgres-fallback.mjs`)) {
  const database = startPlainPostgres();
  const child = spawnSync(process.execPath, [path.join(repoRoot, 'scripts/check-rls-smoke.mjs')], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: libpqChildEnv({ ...process.env, DATABASE_URL: database, RLS_SMOKE_REQUIRED: '1' }),
  });
  process.exit(child.status ?? 1);
}
