import { spawn } from 'node:child_process';
import { assertHttpsDevUrl, HOSTED_DEV_ORIGIN } from '../../lib/hosted-dev/hostedDevUrl.ts';

const origin = process.env.HOSTED_DEV_BASE_URL?.trim() || HOSTED_DEV_ORIGIN;
assertHttpsDevUrl(origin);
process.env.HOSTED_DEV_BASE_URL = origin;
delete process.env.HOSTED_DEV_ISOLATED;
delete process.env.HOSTED_DEV_REQUIRE_IDENTITY;

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
  '--project=smoke',
]);
const summarizeCode = await run('node', ['scripts/hosted-dev/summarize-results.mts']);
const redactCode = await run('node', ['scripts/hosted-dev/redact-artifacts.mts']);
process.exit(playwrightCode || summarizeCode || redactCode);
