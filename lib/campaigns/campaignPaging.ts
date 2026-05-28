export const CAMPAIGN_PAGE_SIZE = 8;

export type CampaignStatusFilter = 'all' | 'draft' | 'sending' | 'sent' | 'failed';

export function parseCampaignPage(raw: string | undefined): number {
  const n = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function parseCampaignStatusFilter(raw: string | undefined): CampaignStatusFilter {
  if (raw === 'draft' || raw === 'sending' || raw === 'sent' || raw === 'failed') return raw;
  return 'all';
}

export function buildCampaignSearchParams(params: {
  status?: CampaignStatusFilter;
  page?: number;
}): string {
  const search = new URLSearchParams();
  if (params.status && params.status !== 'all') search.set('status', params.status);
  if (params.page && params.page > 1) search.set('page', String(params.page));
  const q = search.toString();
  return q ? `?${q}` : '';
}
