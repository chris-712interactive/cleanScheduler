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
 * middleware *rewrites* the URL internally based on the resolved portal:
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
 * Note: Supabase session-refresh wiring is intentionally not in this file
 * yet. It will be added once the auth flow lands in a follow-up task.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export type PortalKind = 'marketing' | 'admin' | 'customer' | 'tenant';

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
};

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

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
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
    },
  );

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return { userId: null, cookiesToSet };
  }
  return { userId: data.user?.id ?? null, cookiesToSet };
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const apex = getApexHost();
  const subdomain = extractSubdomainLabel(host, apex);
  const { kind, tenantSlug } = classify(subdomain);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-portal', kind);
  if (tenantSlug) {
    requestHeaders.set('x-tenant-slug', tenantSlug);
  }

  // Build the rewritten URL. Avoid double-prefixing if the request is already
  // hitting an internal portal path (e.g. when Next.js itself recursively
  // calls the middleware for an asset chunk that lives under the rewritten
  // path).
  const url = request.nextUrl.clone();
  const prefix = PORTAL_PATH_PREFIX[kind];
  const alreadyPrefixed = url.pathname === prefix || url.pathname.startsWith(`${prefix}/`);

  if (!alreadyPrefixed) {
    url.pathname = url.pathname === '/' ? prefix : `${prefix}${url.pathname}`;
  }

  const { userId, cookiesToSet } = await resolveUser(request);
  const isProtectedPortal = kind !== 'marketing';
  if (isProtectedPortal && !userId) {
    const nextPath = request.nextUrl.pathname + request.nextUrl.search;
    const redirectUrl = buildMarketingUrl(request, '/sign-in', nextPath);
    const redirect = NextResponse.redirect(redirectUrl);
    applyCookies(redirect, cookiesToSet);
    return redirect;
  }

  const rewrite = NextResponse.rewrite(url, {
    request: {
      headers: requestHeaders,
    },
  });
  applyCookies(rewrite, cookiesToSet);
  return rewrite;
}

export const config = {
  // Run on every request except Next.js internals, file assets, and favicons.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
};
