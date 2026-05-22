/** Best-effort US phone normalization to E.164 (+1XXXXXXXXXX). */
export function normalizePhoneToE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  if (raw.trim().startsWith('+') && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}
