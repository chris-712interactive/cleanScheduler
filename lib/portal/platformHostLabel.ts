/**
 * The single subdomain label under the apex, such as `admin` in `admin.lvh.me`.
 * Nested names (`admin.evil.lvh.me`) are not a portal label. The first label
 * of those hosts is not the admin portal, the customer portal, or a tenant.
 */
export function platformHostLabel(host: string, apex: string): string | null {
  const apexHostname = apex.split(':')[0]?.toLowerCase().replace(/\.$/, '') ?? '';
  const hostname = host.split(':')[0]?.toLowerCase().replace(/\.$/, '') ?? '';
  if (!apexHostname || !hostname || hostname === apexHostname) return null;
  const suffix = `.${apexHostname}`;
  if (!hostname.endsWith(suffix)) return null;
  const prefix = hostname.slice(0, -suffix.length);
  if (!prefix || prefix.includes('.')) return null;
  return prefix;
}
