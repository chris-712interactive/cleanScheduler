import { publicEnv } from '@/lib/env';

/** Browser-facing origin for a subdomain (empty string = apex marketing host). */
export function getPublicOrigin(subdomain: string | null): string {
  const host = publicEnv.NEXT_PUBLIC_APP_DOMAIN;
  const proto =
    host.includes('localhost') || host.includes('127.0.0.1') || host.startsWith('lvh.me')
      ? 'http'
      : 'https';
  if (!subdomain) {
    return `${proto}://${host}`;
  }
  return `${proto}://${subdomain}.${host}`;
}
