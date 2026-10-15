export type InferredPortalKind = 'marketing' | 'admin' | 'customer' | 'tenant';

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

function subdomainLabel(host: string, apexDomain: string): string | null {
  const apexWithoutPort = apexDomain.split(':')[0]!.toLowerCase();
  const hostWithoutPort = host.split(':')[0]!.toLowerCase();
  if (hostWithoutPort === apexWithoutPort) return null;
  if (!hostWithoutPort.endsWith(`.${apexWithoutPort}`)) return null;
  const prefix = hostWithoutPort.slice(0, -apexWithoutPort.length - 1);
  return prefix.split('.')[0] ?? null;
}

/**
 * Portal identity for requests the rewrite skips, such as `/api/*`.
 * Those requests do not receive `x-portal`.
 */
export function inferPortalFromHost(
  host: string | null | undefined,
  apexDomain: string,
): { kind: InferredPortalKind; tenantSlug: string | null } {
  if (!host?.trim()) return { kind: 'marketing', tenantSlug: null };
  const label = subdomainLabel(host, apexDomain);
  if (label === 'my') return { kind: 'customer', tenantSlug: null };
  if (label === 'admin') return { kind: 'admin', tenantSlug: null };
  if (!label || label === 'www' || RESERVED_SUBDOMAINS.has(label)) {
    return { kind: 'marketing', tenantSlug: null };
  }
  return { kind: 'tenant', tenantSlug: label };
}
