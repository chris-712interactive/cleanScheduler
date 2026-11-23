import { createHash } from 'node:crypto';

/** How long a matching active series counts as the same submit. */
export const RECENT_SERIES_WINDOW_MS = 2 * 60 * 1000;

export type RecentSeriesRow = {
  id: string;
  created_at: string;
  rrule_definition: string;
  anchor_starts_at: string;
};

/**
 * Primary key for one create of the same customer series inside the window.
 * Concurrent inserts share this id, so the existing primary key admits one row.
 */
export function seriesCreateIdempotencyId(input: {
  tenantId: string;
  customerId: string;
  rruleDefinition: string;
  anchorStartsAt: string;
  now: Date;
}): string {
  const anchorMs = new Date(input.anchorStartsAt).getTime();
  const anchorKey = Number.isFinite(anchorMs) ? String(anchorMs) : input.anchorStartsAt.trim();
  const bucket = Math.floor(input.now.getTime() / RECENT_SERIES_WINDOW_MS);
  const digest = createHash('sha256')
    .update(
      [
        input.tenantId.trim(),
        input.customerId.trim(),
        input.rruleDefinition.trim(),
        anchorKey,
        String(bucket),
      ].join('\n'),
    )
    .digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Postgres unique_violation. The series primary key is the only unique constraint. */
export function isSeriesCreateConflict(error: { code?: string } | null | undefined): boolean {
  return error?.code === '23505';
}

/**
 * A second submit of the same customer series (same repeat rule and anchor)
 * inside the window. This catches a row that already committed, including one
 * saved before the idempotency id above.
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
