/** Date column on the tenant transactions table (e.g. May 23, 2025). */
export function formatTransactionDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Amount column — payments display as negative in the ledger mock. */
export function formatTransactionAmount(cents: number): string {
  const n = Number.isFinite(cents) ? Math.abs(cents) : 0;
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(n / 100);
  return `-${formatted}`;
}

export function transactionStatusLabel(): string {
  return 'Paid';
}

export function transactionMethodDetail(
  method: string,
  recordedVia: string,
  notes: string | null,
): { label: string; mask: string | null; isCard: boolean } {
  const isCard = method === 'card' || recordedVia === 'stripe_checkout';

  if (isCard) {
    const mask = extractCardMask(notes);
    return { label: 'Card', mask, isCard: true };
  }

  const labels: Record<string, string> = {
    cash: 'Cash',
    check: 'Check',
    zelle: 'Zelle',
    ach: 'ACH',
    other: 'Other',
  };

  return {
    label: labels[method] ?? method,
    mask: null,
    isCard: false,
  };
}

function extractCardMask(notes: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/\b(\d{4})\b/);
  return match ? `•••• ${match[1]}` : null;
}
