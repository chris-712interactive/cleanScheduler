/**
 * One command for the disposable local stack.
 * Docker: Supabase CLI, seed, RLS SQL, authenticated Playwright, stubbed backfill.
 * No Docker: exit 1 unless --postgres-fallback, which runs the RLS SQL only.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLocalStackEnv, libpqChildEnv } from './local-only-url.mjs';
import { startPlainPostgres } from './postgres-fallback.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const args = new Set(process.argv.slice(2));
const fallbackOnly = args.has('--postgres-fallback');
const keep = args.has('--keep');
const skipBrowser = args.has('--skip-browser');
const skipBuild = args.has('--skip-build');
const summaryPath = path.join(repoRoot, '.local-stack/summary.txt');
const geocodeUrl = 'http://127.0.0.1:5499/geocoder/locations/onelineaddress';

const STRIPPED_SECRETS = [
  'RESEND_API_KEY',
  'RESEND_WEBHOOK_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_CONNECT_WEBHOOK_SECRET',
  'GEOCODIO_API_KEY',
  'PLAID_SECRET',
  'PLAID_CLIENT_ID',
  'SENT_DM_API_KEY',
  'SENTDM_API_KEY',
  'MAPRICOT_API_KEY',
  'OUTBOUND_SUPPRESSED',
  'SUPABASE_ACCESS_TOKEN',
];

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    stdio: 'inherit',
    ...options,
  });
  if (result.error) {
    console.error(result.error.message);
    return result.status ?? 1;
  }
  return result.status ?? 1;
}

function must(command, commandArgs, options = {}) {
  const status = run(command, commandArgs, options);
  if (status !== 0) {
    throw new Error(`${command} exited ${status}`);
  }
}

function writeSummary(lines) {
  mkdirSync(path.dirname(summaryPath), { recursive: true });
  writeFileSync(summaryPath, `${lines.join('\n')}\n`);
}

function startSupabase(cliEnv) {
  const args = [
    'start',
    '--exclude',
    'studio,edge-runtime,logflare,vector,imgproxy,mailpit,postgres-meta,supavisor',
    '--yes',
  ];
  let status = 1;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    status = run('supabase', args, { env: cliEnv });
    if (status === 0) return;
    console.error(`supabase start exited ${status} on attempt ${attempt}.`);
    run('supabase', ['stop'], { env: cliEnv });
    spawnSync('sleep', ['4']);
  }
  throw new Error(`supabase exited ${status}`);
}

function dockerOk() {
  const result = spawnSync('docker', ['info'], { stdio: 'ignore' });
  return result.status === 0;
}

function ensureHosts() {
  let hosts = '';
  try {
    hosts = readFileSync('/etc/hosts', 'utf8');
  } catch {
    return;
  }
  if (hosts.includes('qa-residential.lvh.me')) return;
  const line =
    '127.0.0.1 lvh.me my.lvh.me admin.lvh.me qa-residential.lvh.me qa-commercial.lvh.me\n';
  const result = spawnSync('sudo', ['tee', '-a', '/etc/hosts'], { input: line, stdio: 'pipe' });
  if ((result.status ?? 1) !== 0) {
    console.warn('Could not add lvh.me hosts. Wildcard DNS for lvh.me must resolve to 127.0.0.1.');
  }
}

function parseStatusEnv(text) {
  const map = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim().replace(/^export\s+/, '');
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (/^[A-Z0-9_]+$/.test(key)) map[key] = value;
  }
  return map;
}

function localEnvFromStatus(text) {
  const map = parseStatusEnv(text);
  const apiUrl = map.API_URL || map.SUPABASE_URL;
  const anon = map.ANON_KEY || map.PUBLISHABLE_KEY || map.SUPABASE_ANON_KEY;
  const service = map.SERVICE_ROLE_KEY || map.SECRET_KEY || map.SUPABASE_SERVICE_ROLE_KEY;
  const database = map.DB_URL || map.DATABASE_URL;
  if (!apiUrl || !anon || !service || !database) {
    throw new Error(
      `supabase status did not include the local API keys (saw ${Object.keys(map).join(', ') || 'no keys'})`,
    );
  }
  const env = libpqChildEnv(process.env);
  for (const name of STRIPPED_SECRETS) delete env[name];
  env.NEXT_PUBLIC_APP_ENV = 'local';
  env.NEXT_PUBLIC_APP_DOMAIN = 'lvh.me:3000';
  env.NEXT_PUBLIC_SUPABASE_URL = apiUrl;
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY = anon;
  env.SUPABASE_SERVICE_ROLE_KEY = service;
  env.DATABASE_URL = database;
  env.CENSUS_GEOCODE_URL = geocodeUrl;
  env.RLS_SMOKE_REQUIRED = '1';
  env.NODE_OPTIONS = process.env.NODE_OPTIONS ?? '--max-old-space-size=4096';
  assertLocalStackEnv(env);
  return env;
}

function startGeocodeStub() {
  const child = spawn(process.execPath, [path.join(__dirname, 'geocode-stub.mjs')], {
    cwd: repoRoot,
    stdio: 'inherit',
    detached: false,
  });
  return child;
}

async function waitForStub() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(geocodeUrl);
      if (response.status === 200 || response.status === 503) return;
    } catch {
      // The stub is still binding the port.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Local geocode stub did not start.');
}

function runPostgresFallback() {
  const databaseUrl = startPlainPostgres();
  const status = run(process.execPath, [path.join(repoRoot, 'scripts/check-rls-smoke.mjs')], {
    env: libpqChildEnv({
      ...process.env,
      DATABASE_URL: databaseUrl,
      RLS_SMOKE_REQUIRED: '1',
    }),
  });
  const lines = [
    'mode=postgres-fallback',
    `rls=${status === 0 ? 'passed' : 'failed'}`,
    'playwright=blocked docker-required',
    'backfill=blocked docker-required',
  ];
  writeSummary(lines);
  console.log(lines.join('\n'));
  if (status !== 0) process.exit(status);
  console.log(
    'Authenticated Playwright and geocode backfill were not run. They need the local Supabase API, which needs Docker.',
  );
}

async function runDockerStack() {
  const started = Date.now();
  ensureHosts();
  const stub = startGeocodeStub();
  const cliEnv = libpqChildEnv(process.env);
  let env;
  try {
    await waitForStub();
    startSupabase(cliEnv);
    const status = spawnSync('supabase', ['status', '-o', 'env'], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: cliEnv,
    });
    if ((status.status ?? 1) !== 0) {
      throw new Error(status.stderr || 'supabase status failed');
    }
    env = localEnvFromStatus(`${status.stdout ?? ''}\n${status.stderr ?? ''}`);
    must(process.execPath, [path.join(__dirname, 'seed.mjs')], { env });
    must(process.execPath, [path.join(repoRoot, 'scripts/check-rls-smoke.mjs')], { env });
    if (!skipBuild) {
      must('npm', ['run', 'build'], { env });
    }
    let playwrightPassed = 0;
    let playwrightExpected = 0;
    if (!skipBrowser) {
      must(
        'npx',
        ['playwright', 'install', ...(process.env.CI ? ['--with-deps'] : []), 'chromium'],
        {
          env,
        },
      );
      const playwrightStatus = run(
        'npx',
        ['playwright', 'test', '-c', 'playwright.local-stack.config.ts'],
        { env },
      );
      try {
        const report = JSON.parse(
          readFileSync(path.join(repoRoot, '.local-stack/playwright.json'), 'utf8'),
        );
        playwrightPassed = report.stats?.expected ?? 0;
        playwrightExpected = (report.stats?.expected ?? 0) + (report.stats?.unexpected ?? 0);
        console.log(
          `authenticated playwright passed=${report.stats?.expected ?? 0} failed=${report.stats?.unexpected ?? 0} skipped=${report.stats?.skipped ?? 0}`,
        );
      } catch {
        console.error('Playwright did not write .local-stack/playwright.json');
      }
      if (playwrightStatus !== 0) {
        throw new Error(`playwright exited ${playwrightStatus}`);
      }
    }
    must(process.execPath, [path.join(__dirname, 'backfill-smoke.mjs')], { env });
    const seconds = Math.round((Date.now() - started) / 1000);
    const lines = [
      'mode=supabase-docker',
      'rls=passed',
      'rls_sql_files=7',
      `playwright_passed=${playwrightPassed}`,
      `playwright_total=${playwrightExpected}`,
      'backfill=passed',
      'geocoder=stub',
      `seconds=${seconds}`,
    ];
    writeSummary(lines);
    console.log(lines.join('\n'));
  } finally {
    stub.kill('SIGTERM');
    if (!keep) {
      spawnSync('supabase', ['stop'], { cwd: repoRoot, stdio: 'inherit', env: cliEnv });
    }
  }
}

if (!dockerOk()) {
  if (!fallbackOnly) {
    writeSummary([
      'mode=unavailable',
      'rls=not_run',
      'playwright=blocked docker-required',
      'backfill=blocked docker-required',
    ]);
    console.error(
      'Docker is not available, so the local Supabase stack did not start. Authenticated browser tests and the geocode backfill need that API.',
    );
    console.error('For the RLS SQL only, run: npm run test:local-stack -- --postgres-fallback');
    process.exit(1);
  }
  runPostgresFallback();
} else if (fallbackOnly) {
  runPostgresFallback();
} else {
  runDockerStack().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Local stack failed.');
    process.exit(1);
  });
}
