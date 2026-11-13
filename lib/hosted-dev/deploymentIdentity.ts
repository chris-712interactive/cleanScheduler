import { HOSTED_DEV_APEX } from '@/lib/hosted-dev/hostedDevUrl';
import { isProductionOutboundHost, readOutboundSuppression } from '@/lib/outbound/suppression';

export type StripePublishableMode = 'live' | 'test' | 'unset' | 'unknown';

export type DeploymentIdentity = {
  service: 'cleanscheduler';
  appEnv: string | null;
  appDomain: string | null;
  gitSha: string | null;
  gitRef: string | null;
  deploymentId: string | null;
  vercelEnv: string | null;
  targetEnv: string | null;
  supabaseHost: string | null;
  stripePublishableMode: StripePublishableMode;
  plaidEnv: string | null;
  /** True only when this server process has the dev-only outbound switch on. */
  outboundSuppressed: boolean;
};

export type IdentityDecision =
  | { status: 'ok'; identity: DeploymentIdentity }
  | { status: 'missing'; httpStatus: number }
  | { status: 'reject'; reason: string };

type EnvSource = Record<string, string | undefined>;

const SHA = /^[0-9a-f]{40}$/;
const SUPABASE_HOST = /^[a-z0-9]+\.supabase\.co$/;
const PLAID_ENVS = new Set(['sandbox', 'development', 'production']);

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function stripePublishableMode(key: string | undefined): StripePublishableMode {
  const trimmed = key?.trim() ?? '';
  if (!trimmed) return 'unset';
  if (trimmed.startsWith('pk_live_')) return 'live';
  if (trimmed.startsWith('pk_test_')) return 'test';
  return 'unknown';
}

export function supabaseHostname(rawUrl: string | undefined): string | null {
  const trimmed = rawUrl?.trim() ?? '';
  if (!trimmed) return null;
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    return SUPABASE_HOST.test(host) ? host : null;
  } catch {
    return null;
  }
}

function boundedToken(value: string | undefined, allowed: Set<string> | null): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || trimmed.length > 32) return null;
  if (allowed && !allowed.has(trimmed)) return null;
  return trimmed;
}

/**
 * Public deployment facts only. Never pass secret values through.
 * Stripe is reduced to a mode. The Supabase hostname is already public.
 */
export function buildDeploymentIdentity(env: EnvSource): DeploymentIdentity {
  const gitSha = emptyToNull(env.VERCEL_GIT_COMMIT_SHA);
  return {
    service: 'cleanscheduler',
    appEnv: emptyToNull(env.NEXT_PUBLIC_APP_ENV),
    appDomain: emptyToNull(env.NEXT_PUBLIC_APP_DOMAIN),
    gitSha: gitSha && SHA.test(gitSha) ? gitSha : null,
    gitRef: emptyToNull(env.VERCEL_GIT_COMMIT_REF),
    deploymentId: emptyToNull(env.VERCEL_DEPLOYMENT_ID),
    vercelEnv: boundedToken(env.VERCEL_ENV, new Set(['production', 'preview', 'development'])),
    targetEnv: boundedToken(env.VERCEL_TARGET_ENV, null),
    supabaseHost: supabaseHostname(env.NEXT_PUBLIC_SUPABASE_URL),
    stripePublishableMode: stripePublishableMode(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
    plaidEnv: boundedToken(env.PLAID_ENV, PLAID_ENVS),
    outboundSuppressed: readOutboundSuppression(env),
  };
}

export function decideIdentity(input: {
  httpStatus: number;
  body: unknown;
  expectedSha?: string;
  deniedSupabaseProjectRef?: string;
}): IdentityDecision {
  if (input.httpStatus === 404) {
    return { status: 'missing', httpStatus: 404 };
  }
  if (input.httpStatus !== 200) {
    return { status: 'reject', reason: `Identity endpoint returned HTTP ${input.httpStatus}.` };
  }
  if (!input.body || typeof input.body !== 'object') {
    return { status: 'reject', reason: 'Identity endpoint returned an unreadable body.' };
  }
  const body = input.body as Partial<DeploymentIdentity>;
  if (body.service !== 'cleanscheduler') {
    return { status: 'reject', reason: 'Identity endpoint is not cleanScheduler.' };
  }
  const identity: DeploymentIdentity = {
    service: 'cleanscheduler',
    appEnv: typeof body.appEnv === 'string' ? body.appEnv : null,
    appDomain: typeof body.appDomain === 'string' ? body.appDomain : null,
    gitSha: typeof body.gitSha === 'string' ? body.gitSha : null,
    gitRef: typeof body.gitRef === 'string' ? body.gitRef : null,
    deploymentId: typeof body.deploymentId === 'string' ? body.deploymentId : null,
    vercelEnv: typeof body.vercelEnv === 'string' ? body.vercelEnv : null,
    targetEnv: typeof body.targetEnv === 'string' ? body.targetEnv : null,
    supabaseHost: typeof body.supabaseHost === 'string' ? body.supabaseHost : null,
    stripePublishableMode:
      body.stripePublishableMode === 'live' ||
      body.stripePublishableMode === 'test' ||
      body.stripePublishableMode === 'unset' ||
      body.stripePublishableMode === 'unknown'
        ? body.stripePublishableMode
        : 'unknown',
    plaidEnv: typeof body.plaidEnv === 'string' ? body.plaidEnv : null,
    outboundSuppressed: body.outboundSuppressed === true,
  };

  if (identity.appEnv !== 'dev') {
    return { status: 'reject', reason: 'App environment is not dev.' };
  }
  if (identity.appDomain !== HOSTED_DEV_APEX) {
    return { status: 'reject', reason: 'App domain is not dev.cleanscheduler.com.' };
  }
  if (identity.stripePublishableMode === 'live') {
    return { status: 'reject', reason: 'Stripe publishable key is live.' };
  }
  if (identity.plaidEnv === 'production') {
    return { status: 'reject', reason: 'Plaid environment is production.' };
  }
  if (identity.gitRef !== 'dev') {
    return {
      status: 'reject',
      reason: identity.gitRef ? 'Deployed git ref is not dev.' : 'Deployed git ref is missing.',
    };
  }
  if (identity.targetEnv && identity.targetEnv !== 'dev') {
    return { status: 'reject', reason: 'Vercel target environment is not dev.' };
  }
  if (identity.vercelEnv === 'production') {
    return { status: 'reject', reason: 'Vercel environment is production.' };
  }
  if (identity.outboundSuppressed && isProductionOutboundHost(identity.appDomain)) {
    return {
      status: 'reject',
      reason: 'Outbound suppression was reported on a production host.',
    };
  }
  if (identity.supabaseHost && !SUPABASE_HOST.test(identity.supabaseHost)) {
    return { status: 'reject', reason: 'Supabase host is not a hosted project hostname.' };
  }
  const denied = input.deniedSupabaseProjectRef?.trim().toLowerCase();
  if (denied && identity.supabaseHost?.startsWith(`${denied}.`)) {
    return { status: 'reject', reason: 'Supabase host matches the denied production project.' };
  }
  const expectedSha = input.expectedSha?.trim().toLowerCase();
  if (expectedSha) {
    if (!SHA.test(expectedSha)) {
      return { status: 'reject', reason: 'Expected SHA is not a commit SHA.' };
    }
    if (identity.gitSha !== expectedSha) {
      return { status: 'reject', reason: 'Deployed SHA does not match the expected commit.' };
    }
  }
  return { status: 'ok', identity };
}

export async function loadDeploymentIdentity(options: {
  origin: string;
  expectedSha?: string;
  deniedSupabaseProjectRef?: string;
  fetchImpl?: typeof fetch;
  attempts?: number;
  sleepMs?: number;
}): Promise<IdentityDecision> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const attempts = options.attempts ?? 5;
  const sleepMs = options.sleepMs ?? 0;
  let last: IdentityDecision = { status: 'reject', reason: 'Identity was not loaded.' };

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(new URL('/api/health/deployment', options.origin), {
        redirect: 'manual',
        headers: { accept: 'application/json' },
      });
      if (response.status >= 300 && response.status < 400) {
        last = { status: 'reject', reason: 'Identity endpoint redirected.' };
      } else {
        const body: unknown = response.status === 200 ? await response.json() : null;
        last = decideIdentity({
          httpStatus: response.status,
          body,
          expectedSha: options.expectedSha,
          deniedSupabaseProjectRef: options.deniedSupabaseProjectRef,
        });
      }
    } catch {
      last = { status: 'reject', reason: 'Identity endpoint could not be reached.' };
    }

    const retryable =
      last.status === 'reject' &&
      (last.reason === 'Deployed SHA does not match the expected commit.' ||
        last.reason === 'Identity endpoint could not be reached.' ||
        last.reason.startsWith('Identity endpoint returned HTTP 5'));
    if (!retryable || attempt === attempts) return last;
    if (sleepMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, sleepMs));
    }
  }
  return last;
}
