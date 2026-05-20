import type { ReportDateRange } from '@/lib/reports/types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseReportDateRange(
  fromRaw: string | undefined,
  toRaw: string | undefined,
): ReportDateRange {
  let fromInput = fromRaw && DATE_RE.test(fromRaw) ? fromRaw : '';
  let toInput = toRaw && DATE_RE.test(toRaw) ? toRaw : '';

  if (fromInput && toInput && fromInput > toInput) {
    [fromInput, toInput] = [toInput, fromInput];
  }

  const fromIso = fromInput ? `${fromInput}T00:00:00.000Z` : null;
  const toIso = toInput ? `${toInput}T23:59:59.999Z` : null;

  return { fromInput, toInput, fromIso, toIso };
}

export function buildReportSearchParams(params: {
  from?: string;
  to?: string;
  page?: number;
}): string {
  const q = new URLSearchParams();
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.page && params.page > 1) q.set('page', String(params.page));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function defaultReportRange(slug: string): { from: string; to: string } {
  const now = new Date();
  const to = formatDateInput(now);

  if (slug === 'outstanding-balances') {
    return { from: '', to };
  }

  if (slug === 'collections-summary') {
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 6);
    return { from: formatDateInput(from), to };
  }

  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 29);
  return { from: formatDateInput(from), to };
}

function formatDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function formatReportDateRangeLabel(fromInput: string, toInput: string): string | null {
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

export const REPORT_PAGE_SIZE = 25;

export function parseReportPage(raw: string | undefined): number {
  const n = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
