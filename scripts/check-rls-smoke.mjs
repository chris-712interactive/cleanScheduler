#!/usr/bin/env node
/**
 * Run RLS smoke SQL against DATABASE_URL when set (local/CI with Supabase).
 * Skips gracefully when DATABASE_URL is unset so CI without a DB still passes.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const sqlPaths = [
  path.join(repoRoot, 'supabase/tests/rls/tenant_isolation.sql'),
  path.join(repoRoot, 'supabase/tests/rls/tenant_quotes_member_read.sql'),
  path.join(repoRoot, 'supabase/tests/rls/support_session_tenant_read.sql'),
];

const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.log('check:rls-smoke — skipped (DATABASE_URL not set)');
  process.exit(0);
}

for (const sqlPath of sqlPaths) {
  if (!existsSync(sqlPath)) {
    console.error(`check:rls-smoke — missing ${sqlPath}`);
    process.exit(1);
  }

  const result = spawnSync('psql', [databaseUrl, '-v', 'ON_ERROR_STOP=1', '-f', sqlPath], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    console.error('check:rls-smoke — psql not available:', result.error.message);
    process.exit(1);
  }

  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}
