/** Format a compact area label for outreach recipient rows. */
export function formatOutreachArea(params: {
  city?: string | null;
  county?: string | null;
  state?: string | null;
}): string {
  const city = params.city?.trim() || '';
  const county = params.county?.trim() || '';
  const state = params.state?.trim() || '';

  if (city && county && state) return `${city}, ${county} County, ${state}`;
  if (city && state) return `${city}, ${state}`;
  if (city && county) return `${city}, ${county} County`;
  if (county && state) return `${county} County, ${state}`;
  if (city) return city;
  if (county) return `${county} County`;
  if (state) return state;
  return '—';
}

export function summarizeOutreachAreas(
  rows: { city?: string | null; county?: string | null; state?: string | null }[],
): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const state = row.state?.trim() || 'Unknown state';
    const county = row.county?.trim();
    const label = county ? `${county} County, ${state}` : state;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
