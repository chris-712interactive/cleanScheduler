/**
 * Server-only switch that stops outbound provider calls.
 *
 * Reads `OUTBOUND_SUPPRESSED` from the process environment only. It does not
 * read cookies, headers, query strings, or `user_metadata`. The value is not
 * a `NEXT_PUBLIC_` variable, so Next.js does not inline it into the browser.
 *
 * Set `OUTBOUND_SUPPRESSED=1` on the Vercel dev (or Preview) environment.
 * Any other value leaves providers live. The refusal order is:
 * 1. `VERCEL_ENV=production` (any letter case) always refuses.
 * 2. A production cleanscheduler.com host always refuses.
 * 3. `VERCEL_ENV=preview` or `development` allows the flag. Vercel sets
 *    `NODE_ENV=production` on those deploys, including dev.cleanscheduler.com.
 * 4. Otherwise `NODE_ENV=production` refuses unless the app domain is
 *    dev.cleanscheduler.com, a single-label host under it, or localhost.
 * `NODE_ENV=test` and `development` stay allowed so local dev and unit tests work.
 */

export const OUTBOUND_SUPPRESSED_ENV = 'OUTBOUND_SUPPRESSED';

export const OUTBOUND_SUPPRESSED_MESSAGE = 'Outbound providers are suppressed on this environment';

export type SuppressedProviderResult = {
  ok: false;
  suppressed: true;
  error: string;
};

export function suppressedProviderResult(
  provider: string,
  operation: string,
): SuppressedProviderResult {
  logOutboundSuppressed(provider, operation);
  return { ok: false, suppressed: true, error: OUTBOUND_SUPPRESSED_MESSAGE };
}

export class OutboundSuppressedError extends Error {
  constructor() {
    super(OUTBOUND_SUPPRESSED_MESSAGE);
    this.name = 'OutboundSuppressedError';
  }
}

type EnvSource = Record<string, string | undefined>;

function serverOnly(): void {
  if (typeof window !== 'undefined') {
    throw new Error('Outbound suppression is server-only.');
  }
}

function normalizedHost(raw: string | undefined): string {
  return (raw ?? '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

/** Hosts where a production Node process may still suppress outbound calls. */
export function isLocalOrHostedDevDomain(raw: string | null | undefined): boolean {
  const host = normalizedHost(raw ?? undefined);
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
  if (host === 'dev.cleanscheduler.com' || host.endsWith('.dev.cleanscheduler.com')) return true;
  return false;
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
  const vercelEnv = env.VERCEL_ENV?.trim().toLowerCase() ?? '';
  if (vercelEnv === 'production') {
    return 'OUTBOUND_SUPPRESSED cannot be enabled when VERCEL_ENV=production.';
  }
  if (isProductionOutboundHost(env.NEXT_PUBLIC_APP_DOMAIN)) {
    return 'OUTBOUND_SUPPRESSED cannot be enabled when the host is cleanscheduler.com.';
  }
  if (vercelEnv === 'preview' || vercelEnv === 'development') return null;
  const nodeEnv = env.NODE_ENV?.trim().toLowerCase() ?? '';
  if (nodeEnv === 'production' && !isLocalOrHostedDevDomain(env.NEXT_PUBLIC_APP_DOMAIN)) {
    return 'OUTBOUND_SUPPRESSED cannot be enabled when NODE_ENV=production.';
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
