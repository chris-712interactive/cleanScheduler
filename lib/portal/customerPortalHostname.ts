const HOSTNAME_RE =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

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

export function isPlatformApexHost(host: string, apex: string): boolean {
  const apexWithoutPort = apex.split(':')[0]!.toLowerCase();
  const hostWithoutPort = host.split(':')[0]!.toLowerCase();
  return (
    hostWithoutPort === apexWithoutPort || hostWithoutPort.endsWith(`.${apexWithoutPort}`)
  );
}

export function customerPortalCnameTarget(apexDomain: string): string {
  const apex = apexDomain.split(':')[0]!;
  return `my.${apex}`;
}
