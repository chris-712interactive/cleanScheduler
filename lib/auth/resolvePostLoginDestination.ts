import type { User } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/server';
import { sanitizeAuthenticationNext } from '@/lib/auth/allowedRedirectOrigin';
import { extractClaims, type AppRole } from '@/lib/auth/types';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { getCustomerPortalOriginForTenant } from '@/lib/portal/customerPortalOrigin';
import { publicEnv } from '@/lib/env';

export type PostLoginDestinationKind = 'workspace' | 'customer' | 'admin' | 'home';

export interface PostLoginMembership {
  tenantId: string;
  slug: string;
}

export interface ResolvePostLoginDestinationInput {
  appRole: AppRole | null;
  currentTenantId: string | null;
  memberships: PostLoginMembership[];
  /** Sanitized `next` (path or absolute same-site URL). */
  nextPath: string;
  /** Origin of the host where sign-in / MFA / OAuth completed. */
  currentOrigin: string;
  /** Prefer white-label customer portal when known. */
  customerPortalOrigin?: string | null;
}

export interface PostLoginDestination {
  url: string;
  kind: PostLoginDestinationKind;
  ctaLabel: string;
}

type ClassifiedHost = {
  kind: 'marketing' | 'admin' | 'customer' | 'tenant';
  tenantSlug: string | null;
};

function apexHostname(): string {
  return publicEnv.NEXT_PUBLIC_APP_DOMAIN.split(':')[0]!.toLowerCase();
}

function originFromParts(protocol: string, host: string): string {
  return `${protocol}//${host}`;
}

/** Classify apex / admin / my / tenant subdomain for post-login routing. */
export function classifyPostLoginHost(originOrHost: string): ClassifiedHost {
  let host: string;
  try {
    if (originOrHost.includes('://')) {
      host = new URL(originOrHost).hostname.toLowerCase();
    } else {
      host = originOrHost.split(':')[0]!.toLowerCase();
    }
  } catch {
    return { kind: 'marketing', tenantSlug: null };
  }

  const apex = apexHostname();
  if (host === apex) return { kind: 'marketing', tenantSlug: null };
  if (!host.endsWith(`.${apex}`)) return { kind: 'marketing', tenantSlug: null };

  const label = host.slice(0, -(apex.length + 1)).split('.')[0] ?? '';
  if (label === 'admin') return { kind: 'admin', tenantSlug: null };
  if (label === 'my' || label === 'www') {
    return { kind: label === 'my' ? 'customer' : 'marketing', tenantSlug: null };
  }

  const reserved = new Set([
    'api',
    'app',
    'auth',
    'static',
    'cdn',
    'assets',
    'mail',
    'support',
    'help',
    'docs',
    'blog',
    'status',
    'staging',
    'dev',
    'preview',
  ]);
  if (!label || reserved.has(label)) return { kind: 'marketing', tenantSlug: null };
  return { kind: 'tenant', tenantSlug: label };
}

function pathOnly(nextPath: string): string {
  if (nextPath.startsWith('http://') || nextPath.startsWith('https://')) {
    try {
      const url = new URL(nextPath);
      return `${url.pathname}${url.search}${url.hash}` || '/';
    } catch {
      return '/';
    }
  }
  return nextPath.startsWith('/') ? nextPath : '/';
}

function nextTargetOrigin(nextPath: string, currentOrigin: string): string | null {
  if (nextPath.startsWith('http://') || nextPath.startsWith('https://')) {
    try {
      const url = new URL(nextPath);
      return originFromParts(url.protocol, url.host);
    } catch {
      return null;
    }
  }
  try {
    return new URL(currentOrigin).origin;
  } catch {
    return currentOrigin;
  }
}

function joinOriginPath(origin: string, path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${origin.replace(/\/$/, '')}${normalized === '/' ? '/' : normalized}`;
}

function preferredTenantSlug(
  memberships: PostLoginMembership[],
  currentTenantId: string | null,
): string | null {
  if (memberships.length === 0) return null;
  if (currentTenantId) {
    const match = memberships.find((m) => m.tenantId === currentTenantId);
    if (match) return match.slug;
  }
  return memberships[0]!.slug;
}

function homeForRole(input: ResolvePostLoginDestinationInput): PostLoginDestination {
  const tenantSlug = preferredTenantSlug(input.memberships, input.currentTenantId);
  if (tenantSlug) {
    return {
      url: joinOriginPath(getPublicOrigin(tenantSlug), '/'),
      kind: 'workspace',
      ctaLabel: 'Go to your workspace',
    };
  }

  if (input.appRole === 'customer') {
    const origin = input.customerPortalOrigin?.trim() || getPublicOrigin('my');
    return {
      url: joinOriginPath(origin, '/'),
      kind: 'customer',
      ctaLabel: 'Open customer portal',
    };
  }

  if (input.appRole === 'super_admin' || input.appRole === 'admin') {
    return {
      url: joinOriginPath(getPublicOrigin('admin'), '/'),
      kind: 'admin',
      ctaLabel: 'Open admin',
    };
  }

  return {
    url: joinOriginPath(getPublicOrigin(null), '/'),
    kind: 'home',
    ctaLabel: 'Go to homepage',
  };
}

function hostMatchesDestination(
  host: ClassifiedHost,
  destination: PostLoginDestination,
  memberships: PostLoginMembership[],
): boolean {
  if (destination.kind === 'workspace') {
    if (host.kind !== 'tenant' || !host.tenantSlug) return false;
    return memberships.some((m) => m.slug === host.tenantSlug);
  }
  if (destination.kind === 'admin') return host.kind === 'admin';
  if (destination.kind === 'customer') return host.kind === 'customer';
  return host.kind === 'marketing';
}

/**
 * After successful auth, pick the absolute URL for the user’s home portal
 * (or preserve an explicit deep link when already on a matching host).
 */
export function resolvePostLoginDestination(
  input: ResolvePostLoginDestinationInput,
): PostLoginDestination {
  const nextPath = sanitizeAuthenticationNext(input.nextPath);
  const home = homeForRole(input);
  const path = pathOnly(nextPath);
  const currentHost = classifyPostLoginHost(input.currentOrigin);
  const nextOrigin = nextTargetOrigin(nextPath, input.currentOrigin);
  const nextHost = nextOrigin ? classifyPostLoginHost(nextOrigin) : currentHost;

  const deepLink =
    path !== '/' &&
    hostMatchesDestination(nextHost, home, input.memberships) &&
    (nextPath.startsWith('http://') || nextPath.startsWith('https://')
      ? nextPath
      : joinOriginPath(nextOrigin ?? input.currentOrigin, path));

  if (deepLink) {
    return { ...home, url: deepLink };
  }

  const onMatchingHost = hostMatchesDestination(currentHost, home, input.memberships);
  if (onMatchingHost && path !== '/') {
    return { ...home, url: joinOriginPath(input.currentOrigin, path) };
  }

  if (onMatchingHost && path === '/') {
    return { ...home, url: joinOriginPath(input.currentOrigin, '/') };
  }

  // Wrong host: send to the correct portal, preserving a relative deep-link path.
  if (
    path !== '/' &&
    (home.kind === 'workspace' || home.kind === 'admin' || home.kind === 'customer')
  ) {
    const homeOrigin = new URL(home.url).origin;
    return { ...home, url: joinOriginPath(homeOrigin, path) };
  }

  return home;
}

export async function loadPostLoginMemberships(userId: string): Promise<PostLoginMembership[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('tenant_memberships')
    .select(
      `
      tenant_id,
      tenants:tenants!inner ( slug )
    `,
    )
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error || !data) return [];

  const memberships: PostLoginMembership[] = [];
  for (const row of data) {
    const tenants = row.tenants as { slug: string } | { slug: string }[] | null;
    const slug = Array.isArray(tenants) ? tenants[0]?.slug : tenants?.slug;
    if (slug) {
      memberships.push({ tenantId: row.tenant_id, slug });
    }
  }
  return memberships;
}

async function loadCustomerPortalOrigin(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('customer_identities')
    .select('id')
    .eq('auth_user_id', userId)
    .limit(1)
    .maybeSingle();

  if (!data?.id) return null;

  const { data: customer } = await admin
    .from('customers')
    .select('tenant_id')
    .eq('customer_identity_id', data.id)
    .limit(1)
    .maybeSingle();

  if (!customer?.tenant_id) return null;
  return getCustomerPortalOriginForTenant(admin, customer.tenant_id);
}

/**
 * Server helper: resolve destination for the signed-in user after password / MFA / OAuth.
 */
export async function resolvePostLoginDestinationForUser(params: {
  user: User;
  nextPath: string;
  currentOrigin: string;
}): Promise<PostLoginDestination> {
  const claims = extractClaims(params.user);
  const memberships = await loadPostLoginMemberships(params.user.id);
  const customerPortalOrigin =
    claims.appRole === 'customer' && memberships.length === 0
      ? await loadCustomerPortalOrigin(params.user.id)
      : null;

  return resolvePostLoginDestination({
    appRole: claims.appRole,
    currentTenantId: claims.currentTenantId,
    memberships,
    nextPath: params.nextPath,
    currentOrigin: params.currentOrigin,
    customerPortalOrigin,
  });
}
