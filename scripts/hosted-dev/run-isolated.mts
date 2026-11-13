import { spawn } from 'node:child_process';
import { register } from 'node:module';
import { assertHttpsDevUrl, HOSTED_DEV_ORIGIN } from '../../lib/hosted-dev/hostedDevUrl.ts';

register(new URL('./ts-resolver.mts', import.meta.url));
const { mutationGate } = await import('../../lib/hosted-dev/mutationGate.ts');
const { loadDeploymentIdentity } = await import('../../lib/hosted-dev/deploymentIdentity.ts');

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
delete process.env.HOSTED_DEV_MUTATIONS_CONFIRMED;

const identity = await loadDeploymentIdentity({
  origin,
  expectedSha: process.env.HOSTED_DEV_EXPECT_SHA,
  deniedSupabaseProjectRef: process.env.HOSTED_DEV_DENY_SUPABASE_PROJECT_REF,
  attempts: 5,
  sleepMs: 10_000,
});
const deploymentSuppressed =
  identity.status === 'ok' && identity.identity.outboundSuppressed === true;

if (process.env.HOSTED_DEV_MUTATIONS === '1') {
  if (!deploymentSuppressed) {
    console.error(`BLOCKED: ${mutationGate({ outboundSuppressed: false }).reason}`);
  } else {
    process.env.HOSTED_DEV_MUTATIONS_CONFIRMED = '1';
  }
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
if (
  process.env.HOSTED_DEV_MUTATIONS === '1' &&
  process.env.HOSTED_DEV_MUTATIONS_CONFIRMED !== '1'
) {
  process.exit(1);
}
process.exit(playwrightCode || summarizeCode || redactCode);
