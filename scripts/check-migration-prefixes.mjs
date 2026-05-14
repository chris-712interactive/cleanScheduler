/**
 * Fail CI if two migration files share the same numeric prefix (e.g. two `0024_*.sql`).
 * Run: node scripts/check-migration-prefixes.mjs
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'supabase/migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql') && !f.startsWith('._'));
const counts = new Map();

for (const f of files) {
  const m = f.match(/^(\d+)_/);
  if (!m) {
    console.error(`Migration filename must start with digits and underscore: ${f}`);
    process.exit(1);
  }
  const n = m[1];
  counts.set(n, (counts.get(n) ?? 0) + 1);
}

const dupes = [...counts.entries()].filter(([, c]) => c > 1).map(([n]) => n);
if (dupes.length) {
  console.error(`Duplicate migration numeric prefix(es): ${dupes.join(', ')}`);
  process.exit(1);
}
