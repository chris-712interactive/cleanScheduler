import { normalizeExactHost } from '@/lib/portal/customerPortalHostname';

/**
 * The single subdomain label under the apex, such as `admin` in `admin.lvh.me`.
 * Nested names (`admin.evil.lvh.me`) are not a portal label. The first label
 * of those hosts is not the admin portal, the customer portal, or a tenant.
 * One trailing dot is ignored (`admin.lvh.me.`).
 */
export function platformHostLabel(host: string, apex: string): string | null {
  const apexHostname = normalizeExactHost(apex);
  const hostname = normalizeExactHost(host);
  if (!apexHostname || !hostname || hostname === apexHostname) return null;
  const suffix = `.${apexHostname}`;
  if (!hostname.endsWith(suffix)) return null;
  const prefix = hostname.slice(0, -suffix.length);
  if (!prefix || prefix.includes('.')) return null;
  return prefix;
}
