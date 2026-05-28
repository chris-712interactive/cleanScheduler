export const TEAM_PAGE_SIZE = 8;

export function parseTeamPage(raw: string | undefined): number {
  const n = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function buildTeamSearchParams(params: { page?: number }): string {
  const search = new URLSearchParams();
  if (params.page && params.page > 1) {
    search.set('page', String(params.page));
  }
  const q = search.toString();
  return q ? `?${q}` : '';
}
