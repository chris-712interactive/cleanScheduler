import { platformHostLabel } from '@/lib/portal/platformHostLabel';

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

/**
 * Portal identity for requests the rewrite skips, such as `/api/*`.
 * Those requests do not receive `x-portal`.
 */
export function inferPortalFromHost(
  host: string | null | undefined,
  apexDomain: string,
): { kind: InferredPortalKind; tenantSlug: string | null } {
  if (!host?.trim()) return { kind: 'marketing', tenantSlug: null };
  const label = platformHostLabel(host, apexDomain);
  if (label === 'my') return { kind: 'customer', tenantSlug: null };
  if (label === 'admin') return { kind: 'admin', tenantSlug: null };
  if (!label || label === 'www' || RESERVED_SUBDOMAINS.has(label)) {
    return { kind: 'marketing', tenantSlug: null };
  }
  return { kind: 'tenant', tenantSlug: label };
}
