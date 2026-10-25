import { isPlatformApexHost } from '@/lib/portal/customerPortalHostname';

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

export type SeoHostClassification =
  | { kind: 'platform' }
  | { kind: 'tenant-subdomain'; tenantSlug: string }
  | { kind: 'custom-domain'; hostname: string };

function subdomainLabel(host: string, apexDomain: string): string | null {
  const apexWithoutPort = apexDomain.split(':')[0]!.toLowerCase();
  const hostWithoutPort = host.split(':')[0]!.toLowerCase();
  if (hostWithoutPort === apexWithoutPort) return null;
  if (!hostWithoutPort.endsWith(`.${apexWithoutPort}`)) return null;
  const prefix = hostWithoutPort.slice(0, -apexWithoutPort.length - 1);
  return prefix.split('.')[0] ?? null;
}

/**
 * Which public site `/robots.txt` and `/sitemap.xml` belong to.
 * Platform apex and reserved hosts keep the Clean Scheduler marketing files.
 * Tenant subdomains and custom domains must never advertise the platform sitemap.
 */
export function classifySeoHost(
  host: string | null | undefined,
  apex: string,
): SeoHostClassification {
  if (!host?.trim()) return { kind: 'platform' };

  const raw = host.split(',')[0]!.trim().toLowerCase();
  if (!isPlatformApexHost(raw, apex)) {
    const hostname = raw.split(':')[0] ?? raw;
    return { kind: 'custom-domain', hostname };
  }

  const label = subdomainLabel(raw, apex);
  if (!label || RESERVED_SUBDOMAINS.has(label)) return { kind: 'platform' };
  return { kind: 'tenant-subdomain', tenantSlug: label };
}
