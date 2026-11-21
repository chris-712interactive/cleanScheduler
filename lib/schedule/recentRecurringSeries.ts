/** How long a matching active series counts as the same submit. */
export const RECENT_SERIES_WINDOW_MS = 2 * 60 * 1000;

export type RecentSeriesRow = {
  id: string;
  created_at: string;
  rrule_definition: string;
  anchor_starts_at: string;
};

/**
 * A second submit of the same customer series (same repeat rule and anchor)
 * inside the window. No unique index — this only catches the row that already committed.
 */
export function recentDuplicateSeriesId(
  rows: RecentSeriesRow[],
  input: { rruleDefinition: string; anchorStartsAt: string; now: Date },
): string | null {
  const anchor = new Date(input.anchorStartsAt).getTime();
  if (!Number.isFinite(anchor)) return null;
  const cutoff = input.now.getTime() - RECENT_SERIES_WINDOW_MS;
  const rrule = input.rruleDefinition.trim();
  for (const row of rows) {
    const created = new Date(row.created_at).getTime();
    if (!Number.isFinite(created) || created < cutoff) continue;
    if (row.rrule_definition.trim() !== rrule) continue;
    if (new Date(row.anchor_starts_at).getTime() !== anchor) continue;
    return row.id;
  }
  return null;
}
