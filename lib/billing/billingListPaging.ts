export const BILLING_LIST_PAGE_SIZE = 25;

export function parseBillingListPage(raw: string | undefined): number {
  const n = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function buildBillingListSearchParams(params: { page?: number }): string {
  const q = new URLSearchParams();
  if (params.page && params.page > 1) q.set('page', String(params.page));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function billingListRange(page: number): { from: number; to: number } {
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * BILLING_LIST_PAGE_SIZE;
  const to = from + BILLING_LIST_PAGE_SIZE - 1;
  return { from, to };
}
