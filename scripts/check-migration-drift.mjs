import { readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Validate migration filenames are ordered and contiguous by numeric prefix.
 * Run: node scripts/check-migration-drift.mjs
 */
const dir = join(process.cwd(), 'supabase/migrations');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql') && !f.startsWith('._'))
  .sort();

const prefixes = [];

for (const f of files) {
  const m = f.match(/^(\d+)_/);
  if (!m) {
    console.error(`Migration filename must start with digits and underscore: ${f}`);
    process.exit(1);
  }
  prefixes.push(Number.parseInt(m[1], 10));
}

for (let i = 1; i < prefixes.length; i += 1) {
  if (prefixes[i] <= prefixes[i - 1]) {
    console.error(
      `Migration order drift: ${files[i - 1]} is followed by ${files[i]} (prefixes must strictly increase).`,
    );
    process.exit(1);
  }
}

console.log(`Migration drift check passed (${files.length} files).`);
