import { register } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { HOSTED_DEV_ORIGIN } from '../../lib/hosted-dev/hostedDevUrl.ts';

register(new URL('./ts-resolver.mts', import.meta.url));
const { buildHostedDevReport, renderHostedDevReport } =
  await import('../../lib/hosted-dev/summarizeReport.ts');
const { redactText, secretsFromEnv } = await import('../../lib/hosted-dev/redactText.ts');

const target = process.env.HOSTED_DEV_BASE_URL?.trim() || HOSTED_DEV_ORIGIN;
const playwright = await readFile('hosted-dev-results/playwright.json', 'utf8')
  .then((raw) => JSON.parse(raw) as { suites?: [] })
  .catch(() => null);
const identityRaw = await readFile('hosted-dev-results/identity.json', 'utf8').catch(() => '');
let identityNote = 'missing: identity file was not written';
if (identityRaw) {
  const identity = JSON.parse(identityRaw) as {
    status?: string;
    reason?: string;
    identity?: { gitSha?: string | null; deploymentId?: string | null };
  };
  if (identity.status === 'ok') {
    identityNote = `ok sha=${identity.identity?.gitSha ?? 'unknown'} deployment=${identity.identity?.deploymentId ?? 'unknown'}`;
  } else if (identity.status === 'missing') {
    identityNote = 'missing: /api/health/deployment returned 404 on this deployment';
  } else {
    identityNote = `reject: ${identity.reason ?? 'rejected'}`;
  }
}

const report = buildHostedDevReport({
  target,
  playwright,
  env: process.env,
  identityNote,
});
const secrets = secretsFromEnv(process.env);
const rendered = redactText(renderHostedDevReport(report), secrets);
await writeFile(
  'hosted-dev-results/report.json',
  `${redactText(JSON.stringify(report, null, 2), secrets)}\n`,
);
await writeFile('hosted-dev-results/report.md', rendered);
console.log(rendered);
if (report.overall === 'fail') process.exitCode = 1;
