const HOSTNAME_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function normalizeCustomerPortalHostname(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  let host = trimmed;
  if (host.includes('://')) {
    try {
      host = new URL(host).hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  host = host.replace(/\.$/, '').split(':')[0] ?? '';
  if (!HOSTNAME_RE.test(host)) return null;
  if (host === 'localhost' || host.endsWith('.localhost')) return null;
  return host;
}

export function customerPortalVerificationRecordName(hostname: string): string {
  return `_cleanscheduler-verify.${hostname}`;
}

/**
 * Lowercase hostname with the port removed and a single trailing dot stripped.
 * `admin.lvh.me.` and `admin.lvh.me.:3000` become `admin.lvh.me`. A second
 * trailing dot is left in place so the host no longer matches the apex.
 */
export function normalizeExactHost(host: string): string {
  const withoutPort = host.trim().toLowerCase().split(':')[0] ?? '';
  return withoutPort.endsWith('.') ? withoutPort.slice(0, -1) : withoutPort;
}

/** True when `host` is the apex or a name under that exact apex. */
export function isPlatformApexHost(host: string, apex: string): boolean {
  const apexHost = normalizeExactHost(apex);
  const hostname = normalizeExactHost(host);
  if (!apexHost || !hostname) return false;
  return hostname === apexHost || hostname.endsWith(`.${apexHost}`);
}

export function customerPortalCnameTarget(apexDomain: string): string {
  const apex = apexDomain.split(':')[0]!;
  return `my.${apex}`;
}
