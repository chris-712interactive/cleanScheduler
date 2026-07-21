import type { CustomerDirectoryStatusParam } from '@/lib/tenant/customerDirectorySearch';

export const CUSTOMER_DIRECTORY_PAGE_SIZE = 25;

export function parseCustomerDirectoryPage(raw: string | undefined): number {
  const n = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function customerDirectoryRange(page: number): { from: number; to: number } {
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * CUSTOMER_DIRECTORY_PAGE_SIZE;
  const to = from + CUSTOMER_DIRECTORY_PAGE_SIZE - 1;
  return { from, to };
}

export function buildCustomerDirectorySearchParams(params: {
  q?: string;
  status?: CustomerDirectoryStatusParam;
  page?: number;
  zone?: string | null;
}): string {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.status && params.status !== 'all') search.set('status', params.status);
  if (params.zone?.trim()) search.set('zone', params.zone.trim());
  if (params.page && params.page > 1) search.set('page', String(params.page));
  const q = search.toString();
  return q ? `?${q}` : '';
}
