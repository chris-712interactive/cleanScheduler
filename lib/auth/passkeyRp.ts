import { publicEnv } from '@/lib/env';

export const PASSKEY_RP_NAME = 'Clean Scheduler';
export const PASSKEY_MAX_PER_USER = 10;
export const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function passkeyApexHostname(): string {
  return publicEnv.NEXT_PUBLIC_APP_DOMAIN.split(':')[0]!.toLowerCase();
}

/**
 * Relying party id for a page hostname.
 * `cleanscheduler.com` covers every tenant subdomain. A custom domain does not match.
 * Loopback uses `localhost`, which is the only id browsers accept for http://localhost.
 */
export function passkeyRpIdForHost(hostname: string): string | null {
  const host = hostname.toLowerCase();
  if (LOOPBACK_HOSTS.has(host)) return 'localhost';

  const apex = passkeyApexHostname();
  if (host === apex || host.endsWith(`.${apex}`)) return apex;
  return null;
}

/** Full origin plus relying party id, or null when this address cannot use passkeys. */
export function passkeyContextForOrigin(origin: string): { origin: string; rpId: string } | null {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  const loopback = LOOPBACK_HOSTS.has(host);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) return null;

  const rpId = passkeyRpIdForHost(host);
  if (!rpId) return null;
  return { origin: url.origin, rpId };
}

const AAGUID_NAMES: Record<string, string> = {
  'fbfc3007-154e-4ecc-8c0b-6e020557d7bd': 'iCloud Keychain',
  'ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4': 'Google Password Manager',
  'bada5566-a7aa-401f-bd96-45619a55120d': '1Password',
  'd548826e-79b4-db40-a3d8-11116f7e8349': 'Bitwarden',
  'b84e4048-15dc-4dd0-8640-f4f60813c8af': 'Chrome on Mac',
  'dd4ec289-e01d-41c9-bb89-70fa845d8bf2': 'iCloud Keychain',
  '08987058-cadc-4b81-b6e1-30de50dcbe96': 'Windows Hello',
};

export function passkeyFriendlyName(aaguid: string | undefined): string {
  if (!aaguid) return 'Passkey';
  return AAGUID_NAMES[aaguid.toLowerCase()] ?? 'Passkey';
}
