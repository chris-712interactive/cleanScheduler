import { createAdminClient } from '@/lib/supabase/server';
import { parseAllowedRedirectOrigin } from '@/lib/auth/allowedRedirectOrigin';

function hostnameFromOrigin(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True when the origin host is an active white-label customer portal domain. */
export async function isActiveWhiteLabelPortalOrigin(
  origin: string | null | undefined,
): Promise<boolean> {
  const hostname = hostnameFromOrigin(String(origin ?? '').trim());
  if (!hostname) return false;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('tenant_customer_portal_domains')
    .select('id')
    .eq('hostname', hostname)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    console.error('[whiteLabelRedirectOrigin] lookup failed:', error.message);
    return false;
  }

  return Boolean(data);
}

/**
 * Validates an OAuth return origin: platform apex/subdomains, or an active
 * white-label customer portal hostname.
 */
export async function parseAllowedAuthRedirectOrigin(
  raw: string | null | undefined,
): Promise<string | null> {
  const platformOrigin = parseAllowedRedirectOrigin(raw);
  if (platformOrigin) return platformOrigin;

  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;

  if (!(await isActiveWhiteLabelPortalOrigin(trimmed))) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}
