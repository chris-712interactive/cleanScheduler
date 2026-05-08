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

function getApexHost(): string {
  return process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'lvh.me:3000';
}

function extractSubdomain(host: string, apex: string): string | null {
  const apexWithoutPort = apex.split(':')[0]!.toLowerCase();
  const hostWithoutPort = host.split(':')[0]!.toLowerCase();

  if (hostWithoutPort === apexWithoutPort) return null;

  if (hostWithoutPort.endsWith(`.${apexWithoutPort}`)) {
    return hostWithoutPort.slice(0, -apexWithoutPort.length - 1);
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

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const apex = getApexHost();
  const subdomain = extractSubdomain(host, apex);
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

  return NextResponse.rewrite(url, {
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  // Run on every request except Next.js internals, file assets, and favicons.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
};
