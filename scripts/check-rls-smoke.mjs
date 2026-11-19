#!/usr/bin/env node
/**
 * Run RLS smoke SQL against a local DATABASE_URL when set.
 * Unset DATABASE_URL skips (exit 0) so the quality job can stay green.
 * RLS_SMOKE_REQUIRED=1 fails instead of skipping. The local-stack job sets it.
 * Hosted database URLs are refused before psql runs.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertLocalDatabaseUrl,
  libpqChildEnv,
  LocalOnlyUrlError,
} from './local-stack/local-only-url.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const sqlPaths = [
  path.join(repoRoot, 'supabase/tests/rls/tenant_isolation.sql'),
  path.join(repoRoot, 'supabase/tests/rls/tenant_quotes_member_read.sql'),
  path.join(repoRoot, 'supabase/tests/rls/support_session_tenant_read.sql'),
];

const databaseUrl = process.env.DATABASE_URL?.trim();
const required = process.env.RLS_SMOKE_REQUIRED === '1';

if (!databaseUrl) {
  if (required) {
    console.error('check:rls-smoke — failed (DATABASE_URL is required for this run)');
    process.exit(1);
  }
  console.log('check:rls-smoke — skipped (DATABASE_URL not set)');
  process.exit(0);
}

try {
  assertLocalDatabaseUrl(databaseUrl);
} catch (error) {
  const message = error instanceof LocalOnlyUrlError ? error.message : 'DATABASE_URL was refused.';
  console.error(`check:rls-smoke — refused: ${message}`);
  process.exit(1);
}

for (const sqlPath of sqlPaths) {
  if (!existsSync(sqlPath)) {
    console.error(`check:rls-smoke — missing ${sqlPath}`);
    process.exit(1);
  }

  const result = spawnSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-f', sqlPath], {
    stdio: 'inherit',
    env: libpqChildEnv(process.env),
  });

  if (result.error) {
    console.error('check:rls-smoke — psql not available:', result.error.message);
    process.exit(1);
  }

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`check:rls-smoke — passed ${sqlPaths.length} SQL files`);
