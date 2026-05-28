import type { CustomerDirectoryStatusParam } from '@/lib/tenant/customerDirectorySearch';

export const CUSTOMER_DIRECTORY_PAGE_SIZE = 8;

export function parseCustomerDirectoryPage(raw: string | undefined): number {
  const n = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function buildCustomerDirectorySearchParams(params: {
  q?: string;
  status?: CustomerDirectoryStatusParam;
  page?: number;
}): string {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.status && params.status !== 'all') search.set('status', params.status);
  if (params.page && params.page > 1) search.set('page', String(params.page));
  const q = search.toString();
  return q ? `?${q}` : '';
}
