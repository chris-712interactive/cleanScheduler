import type { SupabaseClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { publicEnv } from '@/lib/env';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import type { Database } from '@/lib/supabase/database.types';

function portalProto(host: string): 'http' | 'https' {
  return host.includes('localhost') || host.includes('127.0.0.1') || host.startsWith('lvh.me')
    ? 'http'
    : 'https';
}

export function originForHostname(hostname: string): string {
  return `${portalProto(hostname)}://${hostname}`;
}

/** Browser origin for customer portal invites and links (white-label when active). */
export async function getCustomerPortalOriginForTenant(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<string> {
  const { data: row } = await admin
    .from('tenant_customer_portal_domains')
    .select('hostname')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .maybeSingle();

  if (row?.hostname) {
    return originForHostname(row.hostname);
  }

  return getPublicOrigin('my');
}

/** Full customer portal URL for a tenant path (white-label when active). */
export async function customerPortalUrlForTenant(
  admin: SupabaseClient<Database>,
  tenantId: string,
  path: string,
): Promise<string> {
  const origin = await getCustomerPortalOriginForTenant(admin, tenantId);
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${normalized}`;
}

/** Customer portal origin from the current request (shared my.* or white-label host). */
export async function getCustomerPortalOriginFromRequest(): Promise<string> {
  const h = await headers();
  return getCustomerPortalOriginFromRequestHost(h.get('host'));
}

/** Full customer portal URL for the current request host. */
export async function customerPortalUrlFromRequest(path: string): Promise<string> {
  const origin = await getCustomerPortalOriginFromRequest();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${normalized}`;
}

/** Origin from the current request host when it is an active white-label portal. */
export function getCustomerPortalOriginFromRequestHost(host: string | null | undefined): string {
  const trimmed = (host ?? '').trim();
  if (!trimmed) return getPublicOrigin('my');

  const hostname = trimmed.split(':')[0]!.toLowerCase();
  const apex = publicEnv.NEXT_PUBLIC_APP_DOMAIN.split(':')[0]!.toLowerCase();
  if (hostname === `my.${apex}` || hostname === apex) {
    return getPublicOrigin(hostname === apex ? null : 'my');
  }

  return originForHostname(hostname);
}
