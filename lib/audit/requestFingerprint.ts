/**
 * Request identifiers useful for fraud / abuse investigations.
 * Values are truncated for storage in audit payloads.
 */

export type RequestFingerprint = {
  clientIp: string | null;
  userAgent: string | null;
  acceptLanguage: string | null;
};

function firstForwardedIp(xff: string | null): string | null {
  if (!xff) return null;
  const first = xff.split(',')[0]?.trim();
  return first || null;
}

export function clientIpFromHeaders(h: Headers): string | null {
  const fromXff = firstForwardedIp(h.get('x-forwarded-for'));
  if (fromXff) return fromXff.slice(0, 128);
  const real = h.get('x-real-ip')?.trim();
  if (real) return real.slice(0, 128);
  return null;
}

export function requestFingerprintFromHeaders(h: Headers): RequestFingerprint {
  const ua = h.get('user-agent')?.trim() || null;
  const lang = h.get('accept-language')?.trim() || null;
  return {
    clientIp: clientIpFromHeaders(h),
    userAgent: ua ? ua.slice(0, 512) : null,
    acceptLanguage: lang ? lang.slice(0, 128) : null,
  };
}

/** Flat payload fields for `audit_log_entries.payload`. */
export function requestFingerprintAuditFields(
  fingerprint: RequestFingerprint,
): Record<string, string | null> {
  return {
    client_ip: fingerprint.clientIp,
    user_agent: fingerprint.userAgent,
    accept_language: fingerprint.acceptLanguage,
  };
}
