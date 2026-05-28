/**
 * Validates the browser-reported origin for auth redirects (sign-up confirmation,
 * OAuth return paths built from the app origin).
 *
 * Supabase only honors redirect URLs when they exactly match an entry under
 * Authentication → URL Configuration → Redirect URLs. If the server builds a
 * wrong origin (Host / X-Forwarded-Host mismatch on some proxies), Supabase
 * may fall back to Site URL — often the apex — which sends users to the wrong
 * host.
 *
 * The sign-in form passes `return_origin` from window.location.origin; we
 * whitelist against NEXT_PUBLIC_APP_DOMAIN (apex host, no protocol).
 */

import { publicEnv } from '@/lib/env';

function apexHostname(): string {
  return publicEnv.NEXT_PUBLIC_APP_DOMAIN.split(':')[0]!.toLowerCase();
}

/**
 * Returns a safe origin string for Supabase redirect URLs, or null if invalid.
 */
export function parseAllowedRedirectOrigin(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const apex = apexHostname();

  const isApex = host === apex;
  const isSubdomainOfApex = host.endsWith(`.${apex}`);

  if (!isApex && !isSubdomainOfApex) {
    return null;
  }

  // Preserve explicit port for local dev (e.g. lvh.me:3000).
  return `${url.protocol}//${url.host}`;
}

/**
 * Safe `next` after password sign-in or when embedded in OAuth callback URLs.
 * Allows same-site paths (single leading `/`) or full http(s) URLs whose host
 * is the configured apex or a subdomain (for example the customer portal host).
 */
export function sanitizeAuthenticationNext(raw: string | null | undefined): string {
  if (!raw || typeof raw !== 'string') return '/';
  const trimmed = raw.trim();
  if (!trimmed) return '/';

  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//')) return '/';
    return trimmed;
  }

  const allowedOrigin = parseAllowedRedirectOrigin(trimmed);
  if (!allowedOrigin) return '/';

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return '/';
  }

  const actualOrigin = `${url.protocol}//${url.host}`;
  if (actualOrigin !== allowedOrigin) return '/';

  return trimmed;
}
