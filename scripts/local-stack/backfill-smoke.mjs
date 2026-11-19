/**
 * Runs the geocode backfill CLI against the local API with the loopback stub.
 * The seeded lookup_failed row is old enough to retry. The no_match row stays.
 */
import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLocalStackEnv } from './local-only-url.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const accounts = JSON.parse(readFileSync(path.join(__dirname, 'qa-accounts.json'), 'utf8'));

function fail(message) {
  console.error(message);
  process.exit(1);
}

assertLocalStackEnv(process.env);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) fail('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
if (!process.env.CENSUS_GEOCODE_URL?.trim()) {
  fail('CENSUS_GEOCODE_URL must point at the local geocode stub.');
}

const env = { ...process.env };
delete env.GEOCODIO_API_KEY;

const child = spawnSync(
  process.execPath,
  [
    '--import',
    path.join(__dirname, 'register-ts-extensions.mjs'),
    path.join(repoRoot, 'scripts/backfill-property-geocodes.mts'),
    '--tenant',
    accounts.residential.tenantId,
    '--min-interval-ms',
    '200',
  ],
  { cwd: repoRoot, env, encoding: 'utf8' },
);

if (child.stdout) process.stdout.write(child.stdout);
if (child.stderr) process.stderr.write(child.stderr);
if (child.error) fail(`geocode backfill could not start: ${child.error.message}`);
if ((child.status ?? 1) !== 0) fail(`geocode backfill exited ${child.status ?? 1}`);

const line = child.stdout.trim().split('\n').at(-1) ?? '';
const counts = Object.fromEntries(
  line.split(' ').map((part) => {
    const [name, value] = part.split('=');
    return [name, Number(value)];
  }),
);
if (!Number.isFinite(counts.examined) || counts.examined < 1) {
  fail(`geocode backfill did not report examined rows: ${line}`);
}
if (counts.lookedUp !== 1 || counts.saved !== 1) {
  fail(`geocode backfill expected lookedUp=1 saved=1, got ${line}`);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const retryId = accounts.residential.properties.retry.id;
const missId = accounts.residential.properties.nomatch.id;
const { data, error } = await admin
  .from('tenant_customer_properties')
  .select('id, latitude, longitude, geocode_status, geocode_reason')
  .in('id', [retryId, missId]);
if (error) fail(error.message);

const retry = data?.find((row) => row.id === retryId);
const miss = data?.find((row) => row.id === missId);
if (!retry || retry.geocode_status !== 'ok' || retry.latitude == null || retry.geocode_reason) {
  fail('lookup_failed row was not saved from the stub geocoder.');
}
if (!miss || miss.geocode_reason !== 'no_match' || miss.latitude != null) {
  fail('no_match row was changed by the default backfill.');
}

console.log('geocode backfill smoke passed (stub geocoder, no Census or Geocodio)');
