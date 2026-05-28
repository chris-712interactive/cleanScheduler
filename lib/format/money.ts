/** USD display from integer cents. */
export function formatUsdFromCents(cents: number): string {
  const n = Number.isFinite(cents) ? cents : 0;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n / 100);
}
