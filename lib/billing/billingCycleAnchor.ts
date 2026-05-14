/**
 * Stripe `billing_cycle_anchor` must be a future unix timestamp (seconds).
 * Uses UTC noon on the chosen calendar day (1–28) in the current or next month.
 */
export function computeBillingCycleAnchorUnix(dayOfMonth: number, from: Date = new Date()): number {
  const dom = Math.min(28, Math.max(1, Math.floor(dayOfMonth)));

  const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

  let y = from.getUTCFullYear();
  let m = from.getUTCMonth();
  let d = Math.min(dom, daysInMonth(y, m));
  let candidateMs = Date.UTC(y, m, d, 12, 0, 0);

  if (candidateMs <= from.getTime()) {
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
    d = Math.min(dom, daysInMonth(y, m));
    candidateMs = Date.UTC(y, m, d, 12, 0, 0);
  }

  return Math.floor(candidateMs / 1000);
}
