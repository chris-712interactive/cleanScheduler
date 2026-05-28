const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type PaymentAuditDateRange = {
  fromInput: string;
  toInput: string;
  fromIso: string | null;
  toIso: string | null;
};

/** Parse `from` / `to` query params (YYYY-MM-DD) into UTC day boundaries on recorded_at. */
export function parsePaymentAuditDateRange(
  fromRaw: string | undefined,
  toRaw: string | undefined,
): PaymentAuditDateRange {
  let fromInput = fromRaw && DATE_RE.test(fromRaw) ? fromRaw : '';
  let toInput = toRaw && DATE_RE.test(toRaw) ? toRaw : '';

  if (fromInput && toInput && fromInput > toInput) {
    [fromInput, toInput] = [toInput, fromInput];
  }

  const fromIso = fromInput ? `${fromInput}T00:00:00.000Z` : null;
  const toIso = toInput ? `${toInput}T23:59:59.999Z` : null;

  return { fromInput, toInput, fromIso, toIso };
}

export function buildPaymentAuditSearchParams(params: {
  filter?: string;
  from?: string;
  to?: string;
  page?: number;
}): string {
  const q = new URLSearchParams();
  if (params.filter && params.filter !== 'all') q.set('filter', params.filter);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.page && params.page > 1) q.set('page', String(params.page));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const PAYMENT_AUDIT_PAGE_SIZE = 10;

export function formatPaymentAuditDateRangeLabel(
  fromInput: string,
  toInput: string,
): string | null {
  if (!fromInput && !toInput) return null;
  if (fromInput && toInput) {
    return `${formatDisplayDate(fromInput)} – ${formatDisplayDate(toInput)}`;
  }
  if (fromInput) return `From ${formatDisplayDate(fromInput)}`;
  return `Through ${formatDisplayDate(toInput)}`;
}

function formatDisplayDate(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
