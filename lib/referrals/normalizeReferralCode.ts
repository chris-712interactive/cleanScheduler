/** Normalize referral codes for lookup and storage. */
export function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function generateReferralCodeSuffix(length = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
