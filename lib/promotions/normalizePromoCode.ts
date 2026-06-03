/** Normalize user-entered promo codes for lookup and storage. */
export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase();
}
