/** Tenant-friendly messages for the custom domain setup flow. */

export function customerPortalDomainUserError(
  error: unknown,
  fallback = 'Something went wrong. Please try again or contact support.',
): string {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.trim();
  if (!message) return fallback;
  if (/VERCEL_|vercel\.com|\bVercel\b/i.test(message)) return fallback;
  return message;
}

export function customerPortalDomainStoredError(message: string | null): string | null {
  if (!message?.trim()) return null;
  if (/VERCEL_|vercel\.com|\bVercel\b/i.test(message)) {
    return 'We could not load your DNS instructions. Try refreshing the page or contact support.';
  }
  return message;
}
