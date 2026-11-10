import { spawn } from 'node:child_process';
import { assertHttpsDevUrl, HOSTED_DEV_ORIGIN } from '../../lib/hosted-dev/hostedDevUrl.ts';
import { mutationGate } from '../../lib/hosted-dev/mutationGate.ts';

const origin = process.env.HOSTED_DEV_BASE_URL?.trim() || HOSTED_DEV_ORIGIN;
assertHttpsDevUrl(origin);
process.env.HOSTED_DEV_BASE_URL = origin;

if (process.env.HOSTED_DEV_ISOLATED !== '1') {
  console.error(
    'BLOCKED: HOSTED_DEV_ISOLATED is not 1. Authenticated and RLS checks did not run and are not a pass.',
  );
  process.exit(1);
}

process.env.HOSTED_DEV_REQUIRE_IDENTITY = '1';
if (process.env.HOSTED_DEV_MUTATIONS === '1') {
  console.error(`BLOCKED: ${mutationGate().reason}`);
}

function run(command: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: process.env });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

const playwrightCode = await run('npx', [
  'playwright',
  'test',
  '-c',
  'tests/hosted-dev/playwright.config.ts',
  '--project=isolated',
]);
const summarizeCode = await run('node', ['scripts/hosted-dev/summarize-results.mts']);
const redactCode = await run('node', ['scripts/hosted-dev/redact-artifacts.mts']);
if (process.env.HOSTED_DEV_MUTATIONS === '1') {
  process.exit(1);
}
process.exit(playwrightCode || summarizeCode || redactCode);
