import { mkdir, writeFile } from 'node:fs/promises';
import { loadDeploymentIdentity } from '../../lib/hosted-dev/deploymentIdentity';
import { assertHttpsDevUrl, HOSTED_DEV_ORIGIN } from '../../lib/hosted-dev/hostedDevUrl';

export default async function globalSetup(): Promise<void> {
  const origin = process.env.HOSTED_DEV_BASE_URL?.trim() || HOSTED_DEV_ORIGIN;
  assertHttpsDevUrl(origin);
  const decision = await loadDeploymentIdentity({
    origin,
    expectedSha: process.env.HOSTED_DEV_EXPECT_SHA,
    deniedSupabaseProjectRef: process.env.HOSTED_DEV_DENY_SUPABASE_PROJECT_REF,
    attempts: 5,
    sleepMs: 10_000,
  });
  await mkdir('hosted-dev-results', { recursive: true });
  await writeFile('hosted-dev-results/identity.json', `${JSON.stringify(decision, null, 2)}\n`);
  if (process.env.HOSTED_DEV_REQUIRE_IDENTITY === '1' && decision.status !== 'ok') {
    const reason =
      decision.status === 'missing' ? 'Identity endpoint is missing.' : decision.reason;
    throw new Error(reason);
  }
  if (decision.status === 'reject') {
    throw new Error(decision.reason);
  }
}
