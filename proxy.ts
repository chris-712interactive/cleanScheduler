/**
 * Subdomain resolver + portal URL rewriter.
 *
 * The single deployment serves three portals + a marketing site, switched by
 * subdomain (per implementation plan section 18):
 *
 *   admin.<apex>             - founder admin portal
 *   my.<apex>                - unified customer portal
 *   www.<apex> | <apex>      - marketing site
 *   <tenant-slug>.<apex>     - that tenant's portal
 *
 * To keep distinct route trees per portal without route-collision pain, this
 * proxy *rewrites* the URL internally based on the resolved portal:
 *
 *   admin.<apex>/<path>           ->  /admin/<path>
 *   my.<apex>/<path>              ->  /customer/<path>
 *   <tenant-slug>.<apex>/<path>   ->  /tenant/<path>
 *   <apex>/<path> (incl. www)     ->  /marketing/<path>
 *
 * The rewrite is server-side only - the user still sees the original URL in
 * their browser address bar. Downstream Server Components read the resolved
 * portal kind + tenant slug via `getPortalContext()` (lib/portal.ts) which
 * inspects the `x-portal` / `x-tenant-slug` headers we set here.
 *
 * Reserved subdomain names (admin/api/mail/etc.) cannot be claimed by a
 * tenant - they fall through to the marketing rewrite.
 *
 * Auth: `resolveUser` uses `@supabase/ssr` with cookie `getAll` / `setAll`.
 * `getUser()` refreshes expired sessions when needed and applies updated
 * cookies on the outgoing response (see `applyCookies`).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { resolveTenantSubscriptionAccessForSlug } from '@/lib/billing/resolveTenantSubscriptionAccessForSlug';
import {
  isTenantPortalSuspended,
  isTenantSuspendedEscapePath,
} from '@/lib/billing/tenantSubscriptionAccess';
import { resolveTenantMembershipForSlug } from '@/lib/auth/resolveTenantMembershipForSlug';
import {
  fieldEmployeeCanAccessBrowserPath,
  fieldEmployeeLandingPath,
  isFieldEmployeeRole,
} from '@/lib/tenant/fieldEmployeeAccess';
import { isPlatformApexHost } from '@/lib/portal/customerPortalHostname';
import { customerPortalJoinRedirectUrl } from '@/lib/portal/customerPortalOrigin';
import { resolveActiveTenantPublicDomain } from '@/lib/portal/resolveTenantPublicDomain';
import { applyReferralCookieToResponse } from '@/lib/referrals/referralCookie';
import { debugPerfStart } from '@/lib/performance/debugPerf';

export type PortalKind = 'marketing' | 'admin' | 'customer' | 'tenant' | 'site';

/** Served as marketing routes on any host; no session required (sign-in, OAuth return, post-auth denial). */
const PUBLIC_MARKETING_PATHS = new Set([
  '/sign-in',
  '/sign-in/mfa',
  '/auth/callback',
  '/access-denied',
  '/complete-employee-invite',
  '/start-trial',
  '/forgot-password',
  '/reset-password',
]);

// Subdomains reserved for platform use. Tenants cannot register these.
const RESERVED_SUBDOMAINS = new Set([
  'admin',
  'my',
  'www',
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

const PORTAL_PATH_PREFIX: Record<PortalKind, string> = {
  marketing: '/marketing',
  admin: '/admin',
  customer: '/customer',
  tenant: '/tenant',
  site: '/site',
};

const UNIFIED_SITE_RESERVED_PREFIXES = [
  '/portal',
  '/sign-in',
  '/auth/callback',
  '/access-denied',
  '/complete-employee-invite',
];

function isPublicTenantSitePath(path: string): boolean {
  return path === '/site' || path.startsWith('/site/');
}

function isPublicBookingRequestPath(path: string): boolean {
  return path === '/book' || path === '/request';
}

function isUnifiedMarketingPath(path: string): boolean {
  if (path === '/sitemap.xml' || path === '/robots.txt') return true;
  return !UNIFIED_SITE_RESERVED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

function isUnifiedPortalPath(path: string): boolean {
  return path === '/portal' || path.startsWith('/portal/');
}

function stripUnifiedPortalPrefix(path: string): string {
  if (path === '/portal') return '/';
  if (path.startsWith('/portal/')) return path.slice('/portal'.length) || '/';
  return path;
}

type CookieToSet = { name: string; value: string; options?: CookieOptions };

function getApexHost(): string {
  return process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'lvh.me:3000';
}

function extractSubdomainLabel(host: string, apex: string): string | null {
  const apexWithoutPort = apex.split(':')[0]!.toLowerCase();
  const hostWithoutPort = host.split(':')[0]!.toLowerCase();

  if (hostWithoutPort === apexWithoutPort) return null;

  if (hostWithoutPort.endsWith(`.${apexWithoutPort}`)) {
    const prefix = hostWithoutPort.slice(0, -apexWithoutPort.length - 1);
    const firstLabel = prefix.split('.')[0];
    return firstLabel ?? null;
  }

  // Unrecognised origin (Vercel preview URL, raw IP) - render marketing.
  return null;
}

function classify(subdomain: string | null): { kind: PortalKind; tenantSlug?: string } {
  if (subdomain === null) return { kind: 'marketing' };
  if (subdomain === 'admin') return { kind: 'admin' };
  if (subdomain === 'my') return { kind: 'customer' };
  if (subdomain === 'www') return { kind: 'marketing' };
  if (RESERVED_SUBDOMAINS.has(subdomain)) return { kind: 'marketing' };
  return { kind: 'tenant', tenantSlug: subdomain };
}

function applyCookies(target: NextResponse, cookies: CookieToSet[]) {
  cookies.forEach(({ name, value, options }) => {
    target.cookies.set(name, value, options);
  });
}

function buildMarketingUrl(request: NextRequest, pathname: string, nextPath?: string): URL {
  // Keep redirects on the current host/subdomain so auth cookies are set for
  // the exact portal domain the user is trying to access.
  const url = new URL(pathname, request.url);
  if (nextPath) {
    url.searchParams.set('next', nextPath);
  }
  return url;
}

async function resolveUser(request: NextRequest): Promise<{
  userId: string | null;
  cookiesToSet: CookieToSet[];
}> {
  const cookiesToSet: CookieToSet[] = [];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return { userId: null, cookiesToSet };
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, {
          ...init,
          cache: 'no-store',
        }),
    },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(newCookies: CookieToSet[]) {
        newCookies.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          cookiesToSet.push({ name, value, options });
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return { userId: null, cookiesToSet };
  }
  return { userId: data.user?.id ?? null, cookiesToSet };
}

/** Marketing canonical host is apex (`cleanscheduler.com`), not `www`. */
function buildApexRedirectUrl(request: NextRequest, apex: string): URL {
  const redirectUrl = request.nextUrl.clone();
  const [hostname, port] = apex.split(':');
  redirectUrl.hostname = hostname!.toLowerCase();
  redirectUrl.port = port ?? '';
  return redirectUrl;
}

/** Static files under `public/marketing/` (OG images, screenshots) keep the `/marketing/` URL. */
function isMarketingStaticAssetPath(pathname: string): boolean {
  return /\.[a-zA-Z0-9]{1,8}$/.test(pathname);
}

/**
 * Browser-visible URLs must not use the internal App Router prefix (`/marketing/...`).
 * Those paths are rewrite targets only; serving them as public URLs creates GSC
 * "Alternate page with proper canonical tag" duplicates.
 */
function stripInternalMarketingPrefix(pathname: string): string {
  if (pathname === '/marketing') return '/';
  if (pathname.startsWith('/marketing/')) {
    const stripped = pathname.slice('/marketing'.length);
    return stripped.length > 0 ? stripped : '/';
  }
  return pathname;
}

function shouldStripInternalMarketingPrefix(pathname: string): boolean {
  return (
    (pathname === '/marketing' || pathname.startsWith('/marketing/')) &&
    !isMarketingStaticAssetPath(pathname)
  );
}

export async function proxy(request: NextRequest) {
  const endProxy = debugPerfStart('proxy.request', request.nextUrl.pathname);

  try {
    const host = request.headers.get('host') ?? '';
    const apex = getApexHost();
    const hostWithoutPort = host.split(':')[0]!.toLowerCase();
    const isOurApexHost = isPlatformApexHost(host, apex);
    const tenantPublicDomain = !isOurApexHost
      ? await resolveActiveTenantPublicDomain(hostWithoutPort)
      : null;
    const whiteLabelPortal =
      tenantPublicDomain?.siteMode === 'portal_only' ? tenantPublicDomain : null;
    const unifiedPublicDomain =
      tenantPublicDomain?.siteMode === 'unified' ? tenantPublicDomain : null;

    const subdomain = isOurApexHost ? extractSubdomainLabel(host, apex) : null;
    const requestedPath = request.nextUrl.pathname;

    // Platform sitemap/robots — pass through without rewrite.
    if (
      isOurApexHost &&
      subdomain === null &&
      (requestedPath === '/sitemap.xml' || requestedPath === '/robots.txt')
    ) {
      return NextResponse.next();
    }

    // Consolidate www -> apex for SEO (canonical tags point at apex only).
    if (isOurApexHost && subdomain === 'www') {
      const redirectUrl = buildApexRedirectUrl(request, apex);
      if (shouldStripInternalMarketingPrefix(redirectUrl.pathname)) {
        redirectUrl.pathname = stripInternalMarketingPrefix(redirectUrl.pathname);
      }
      return NextResponse.redirect(redirectUrl, 308);
    }

    // Collapse internal /marketing/* HTML paths to canonical public URLs.
    // (Static assets under public/marketing/ are excluded.)
    if (
      isOurApexHost &&
      subdomain === null &&
      shouldStripInternalMarketingPrefix(requestedPath)
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = stripInternalMarketingPrefix(requestedPath);
      return NextResponse.redirect(redirectUrl, 308);
    }

    const isJoinPath =
      requestedPath === '/join' ||
      requestedPath.startsWith('/join/') ||
      requestedPath === '/portal/join' ||
      requestedPath.startsWith('/portal/join/');
    const isPublicMarketingPath =
      PUBLIC_MARKETING_PATHS.has(requestedPath) ||
      (requestedPath === '/contact' &&
        subdomain === null &&
        !whiteLabelPortal &&
        !unifiedPublicDomain);
    const isPublicCustomerInvite =
      (subdomain === 'my' || whiteLabelPortal || unifiedPublicDomain) &&
      (requestedPath === '/complete-invite' ||
        requestedPath.startsWith('/complete-invite/') ||
        requestedPath === '/portal/complete-invite' ||
        requestedPath.startsWith('/portal/complete-invite/'));
    const isPublicCustomerJoin =
      (subdomain === 'my' || whiteLabelPortal || unifiedPublicDomain) &&
      (requestedPath === '/join' ||
        requestedPath.startsWith('/join/') ||
        requestedPath === '/portal/join' ||
        requestedPath.startsWith('/portal/join/'));

    const onCustomerPortalHost =
      subdomain === 'my' || whiteLabelPortal != null || unifiedPublicDomain != null;
    if (
      isJoinPath &&
      !onCustomerPortalHost &&
      !(unifiedPublicDomain && isUnifiedPortalPath(requestedPath))
    ) {
      const redirect = NextResponse.redirect(customerPortalJoinRedirectUrl(request.nextUrl, apex));
      applyReferralCookieToResponse(redirect, request.nextUrl.searchParams.get('ref'));
      return redirect;
    }

    let baseClassification = whiteLabelPortal
      ? { kind: 'customer' as const, tenantSlug: whiteLabelPortal.tenantSlug }
      : classify(subdomain);

    if (unifiedPublicDomain) {
      if (isUnifiedPortalPath(requestedPath) || isPublicCustomerInvite || isPublicCustomerJoin) {
        baseClassification = {
          kind: 'customer',
          tenantSlug: unifiedPublicDomain.tenantSlug,
        };
      } else if (isUnifiedMarketingPath(requestedPath)) {
        baseClassification = {
          kind: 'site',
          tenantSlug: unifiedPublicDomain.tenantSlug,
        };
      }
    } else if (
      baseClassification.kind === 'tenant' &&
      baseClassification.tenantSlug &&
      (isPublicTenantSitePath(requestedPath) || isPublicBookingRequestPath(requestedPath))
    ) {
      baseClassification = { kind: 'site', tenantSlug: baseClassification.tenantSlug };
    }

    const kind: PortalKind = isPublicMarketingPath ? 'marketing' : baseClassification.kind;
    const tenantSlug =
      isPublicMarketingPath && requestedPath !== '/access-denied'
        ? undefined
        : baseClassification.tenantSlug;

    let rewritePath = requestedPath;
    if (kind === 'site' && unifiedPublicDomain) {
      if (requestedPath === '/sitemap.xml' || requestedPath === '/robots.txt') {
        rewritePath = requestedPath;
      } else if (requestedPath === '/') {
        rewritePath = '/';
      } else if (!requestedPath.startsWith('/site')) {
        rewritePath = `/site${requestedPath}`;
      }
    } else if (kind === 'customer' && unifiedPublicDomain && isUnifiedPortalPath(requestedPath)) {
      rewritePath = stripUnifiedPortalPrefix(requestedPath);
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-portal', kind);
    if (tenantSlug) {
      requestHeaders.set('x-tenant-slug', tenantSlug);
    }
    if (whiteLabelPortal) {
      requestHeaders.set('x-white-label-customer-portal', '1');
      requestHeaders.set('x-white-label-hostname', whiteLabelPortal.hostname);
    }
    if (unifiedPublicDomain) {
      requestHeaders.set('x-unified-public-domain', '1');
      requestHeaders.set('x-white-label-hostname', unifiedPublicDomain.hostname);
      if (kind === 'customer') {
        requestHeaders.set('x-white-label-customer-portal', '1');
      }
    }

    const url = request.nextUrl.clone();
    const prefix = PORTAL_PATH_PREFIX[kind];
    const alreadyPrefixed = url.pathname === prefix || url.pathname.startsWith(`${prefix}/`);

    url.pathname = rewritePath;
    if (kind === 'site' && isPublicBookingRequestPath(requestedPath)) {
      // Public booking form lives at app/book (and /request alias), not under /site.
      url.pathname = requestedPath === '/request' ? '/book' : requestedPath;
    } else if (
      kind === 'marketing' &&
      (requestedPath === '/pay' || requestedPath.startsWith('/pay/'))
    ) {
      // Guest invoice pay links live at app/pay, not under /marketing.
      url.pathname = requestedPath;
    } else if (!alreadyPrefixed) {
      url.pathname = rewritePath === '/' ? prefix : `${prefix}${rewritePath}`;
    }

    // Post-rewrite path (e.g. /tenant/billing) for server-side billing gate / layout decisions.
    requestHeaders.set('x-internal-pathname', url.pathname);
    // Browser-visible path on tenant host (e.g. /quotes) — used for subscription gating.
    requestHeaders.set('x-tenant-pathname', requestedPath);

    const { userId, cookiesToSet } = await resolveUser(request);
    const refParam = request.nextUrl.searchParams.get('ref')?.trim();
    if (
      !userId &&
      (subdomain === 'my' || whiteLabelPortal || unifiedPublicDomain) &&
      (requestedPath === '/' || requestedPath === '/portal') &&
      refParam
    ) {
      const redirectUrl = new URL(unifiedPublicDomain ? '/portal/join' : '/join', request.url);
      redirectUrl.searchParams.set('ref', refParam);
      const redirect = NextResponse.redirect(redirectUrl);
      applyCookies(redirect, cookiesToSet);
      applyReferralCookieToResponse(redirect, refParam);
      return redirect;
    }

    const isProtectedPortal =
      kind !== 'marketing' && kind !== 'site' && !isPublicCustomerInvite && !isPublicCustomerJoin;

    let tenantMembership: Awaited<ReturnType<typeof resolveTenantMembershipForSlug>> = null;
    let tenantSubscription: Awaited<ReturnType<typeof resolveTenantSubscriptionAccessForSlug>> =
      null;

    if (kind === 'tenant' && userId && tenantSlug) {
      [tenantMembership, tenantSubscription] = await Promise.all([
        resolveTenantMembershipForSlug(userId, tenantSlug),
        resolveTenantSubscriptionAccessForSlug(tenantSlug),
      ]);
    }

    const subscriptionLocked =
      tenantSubscription != null && isTenantPortalSuspended(tenantSubscription.access);

    // Hard redirect field employees away from `/` before RSC layout runs (avoids blank first paint after login).
    if (
      kind === 'tenant' &&
      tenantMembership &&
      isFieldEmployeeRole(tenantMembership.role) &&
      (requestedPath === '/' || requestedPath === '')
    ) {
      const landing = fieldEmployeeLandingPath(subscriptionLocked);
      const landingUrl = new URL(landing, request.url);
      const redirect = NextResponse.redirect(landingUrl);
      applyCookies(redirect, cookiesToSet);
      return redirect;
    }

    if (isProtectedPortal && !userId) {
      const nextPath = request.nextUrl.pathname + request.nextUrl.search;
      const redirectUrl = buildMarketingUrl(request, '/sign-in', nextPath);
      const redirect = NextResponse.redirect(redirectUrl);
      applyCookies(redirect, cookiesToSet);
      return redirect;
    }

    if (
      kind === 'tenant' &&
      userId &&
      tenantSlug &&
      !isTenantSuspendedEscapePath(null, requestedPath)
    ) {
      if (subscriptionLocked) {
        const fieldEmployeeOnAllowedPath =
          tenantMembership &&
          isFieldEmployeeRole(tenantMembership.role) &&
          fieldEmployeeCanAccessBrowserPath(requestedPath);

        if (!fieldEmployeeOnAllowedPath) {
          const redirectUrl = request.nextUrl.clone();
          redirectUrl.pathname = '/billing';
          redirectUrl.searchParams.set('subscribe', 'required');
          const redirect = NextResponse.redirect(redirectUrl);
          applyCookies(redirect, cookiesToSet);
          return redirect;
        }
      }
    }

    const rewrite = NextResponse.rewrite(url, {
      request: {
        headers: requestHeaders,
      },
    });
    applyCookies(rewrite, cookiesToSet);
    if (onCustomerPortalHost && refParam) {
      applyReferralCookieToResponse(rewrite, refParam);
    }
    return rewrite;
  } finally {
    endProxy();
  }
}

export const config = {
  // Run on every request except Next.js internals, file assets, and favicons.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)'],
};
