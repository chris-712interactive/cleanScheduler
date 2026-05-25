import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const engines = pkg.engines?.node;
if (!engines) {
  console.error('package.json is missing engines.node');
  process.exit(1);
}

const min = engines.replace(/^>=\s*/, '').trim();
const current = process.versions.node;

function compare(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

if (compare(current, min) < 0) {
  console.error(`Node ${current} does not satisfy engines.node (${engines})`);
  process.exit(1);
}

console.log(`Node ${current} satisfies engines.node (${engines})`);
