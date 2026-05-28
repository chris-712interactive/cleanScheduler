/** Parse a dollar string (e.g. "125.50") to integer cents. */
export function parseCentsFromDollars(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function formatCentsAsDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}
