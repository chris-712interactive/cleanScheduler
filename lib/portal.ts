/**
 * Server-side helper for reading portal classification set by middleware.
 *
 * Server Components and Route Handlers should call `getPortalContext()` to
 * find out which portal (marketing / admin / customer / tenant) the current
 * request is hitting, plus the resolved tenant slug when applicable.
 */
import { headers } from 'next/headers';
import type { PortalKind } from '@/middleware';

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

  return null;
}

/** Fallback for `/api/*` requests where middleware does not set `x-tenant-slug`. */
export function resolveTenantSlugFromHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const subdomain = extractSubdomainLabel(host, getApexHost());
  if (!subdomain || subdomain === 'admin' || subdomain === 'my' || subdomain === 'www') {
    return null;
  }
  if (RESERVED_SUBDOMAINS.has(subdomain)) return null;
  return subdomain;
}

export interface PortalContext {
  kind: PortalKind;
  tenantSlug: string | null;
  /** True when the request arrived on a Pro white-label customer portal hostname. */
  whiteLabelCustomerPortal: boolean;
  whiteLabelHostname: string | null;
}

export async function getPortalContext(): Promise<PortalContext> {
  const h = await headers();
  const kindHeader = h.get('x-portal');
  const kind: PortalKind =
    kindHeader === 'admin' || kindHeader === 'customer' || kindHeader === 'tenant'
      ? kindHeader
      : 'marketing';

  return {
    kind,
    tenantSlug: h.get('x-tenant-slug') ?? resolveTenantSlugFromHost(h.get('host')),
    whiteLabelCustomerPortal: h.get('x-white-label-customer-portal') === '1',
    whiteLabelHostname: h.get('x-white-label-hostname'),
  };
}
