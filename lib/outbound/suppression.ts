/**
 * Server-only switch that stops outbound provider calls.
 *
 * Reads `OUTBOUND_SUPPRESSED` from the process environment only. It does not
 * read cookies, headers, query strings, or `user_metadata`. The value is not
 * a `NEXT_PUBLIC_` variable, so Next.js does not inline it into the browser.
 *
 * Set `OUTBOUND_SUPPRESSED=1` on the Vercel dev (or Preview) environment.
 * Any other value leaves providers live. Production cannot turn it on:
 * `VERCEL_ENV=production` or a cleanscheduler.com host that is not the
 * hosted-dev tree throws, including at server startup.
 */

export const OUTBOUND_SUPPRESSED_ENV = 'OUTBOUND_SUPPRESSED';

type EnvSource = Record<string, string | undefined>;

function serverOnly(): void {
  if (typeof window !== 'undefined') {
    throw new Error('Outbound suppression is server-only.');
  }
}

function normalizedHost(raw: string | undefined): string {
  return (raw ?? '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

/** True for the production apex and its hosts. Hosted dev stays false. */
export function isProductionOutboundHost(raw: string | null | undefined): boolean {
  const host = normalizedHost(raw ?? undefined);
  if (!host) return false;
  if (host === 'cleanscheduler.com' || host === 'www.cleanscheduler.com') return true;
  if (!host.endsWith('.cleanscheduler.com')) return false;
  if (host === 'dev.cleanscheduler.com' || host.endsWith('.dev.cleanscheduler.com')) return false;
  return true;
}

export function outboundSuppressionRefusal(env: EnvSource): string | null {
  if (env.OUTBOUND_SUPPRESSED?.trim() !== '1') return null;
  if (env.VERCEL_ENV?.trim() === 'production') {
    return 'OUTBOUND_SUPPRESSED cannot be enabled when VERCEL_ENV=production.';
  }
  if (isProductionOutboundHost(env.NEXT_PUBLIC_APP_DOMAIN)) {
    return 'OUTBOUND_SUPPRESSED cannot be enabled when the host is cleanscheduler.com.';
  }
  return null;
}

/**
 * Active only when the process env is exactly `1` and this process is not production.
 * Throws when production is asked to suppress outbound calls.
 */
export function readOutboundSuppression(env: EnvSource): boolean {
  serverOnly();
  const refusal = outboundSuppressionRefusal(env);
  if (refusal) throw new Error(refusal);
  return env.OUTBOUND_SUPPRESSED?.trim() === '1';
}

export function isOutboundSuppressed(): boolean {
  return readOutboundSuppression(process.env);
}

/** Fail at startup when production is configured with the switch. */
export function assertOutboundSuppressionAllowed(): void {
  readOutboundSuppression(process.env);
}

export function suppressedId(provider: string, operation: string): string {
  const op = operation
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 48);
  return `suppressed_${provider}_${op}_${crypto.randomUUID()}`;
}

/** One redacted line. Callers must not pass recipients, urls, or secrets. */
export function logOutboundSuppressed(provider: string, operation: string): void {
  const safeProvider = provider.replace(/[^a-z0-9]+/gi, '').slice(0, 24);
  const safeOperation = operation.replace(/[^a-z0-9._]+/gi, '').slice(0, 64);
  console.info(`[outbound] suppressed provider=${safeProvider} operation=${safeOperation}`);
}
