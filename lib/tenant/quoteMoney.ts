/** Format stored cents for display (Stripe-style integer money). */
export function formatQuoteMoney(cents: number | null, currency = 'USD'): string {
  if (cents == null) return '—';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}
