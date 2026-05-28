import { formatDateTimeInTimeZone } from '@/lib/datetime/formatInTimeZone';

export function formatVisitTimeRange(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  timezone: string,
): string | null {
  if (!startsAt) return null;

  const start = formatDateTimeInTimeZone(startsAt, timezone, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  if (!endsAt) return start;

  const end = formatDateTimeInTimeZone(endsAt, timezone, { timeStyle: 'short' });
  return `${start} – ${end}`;
}

export type RescheduleHistoryTimes = {
  fromLabel: string | null;
  requestedLabel: string | null;
  toLabel: string | null;
  outcomeNote: string | null;
  missingOriginalNote: string | null;
};

export function formatRescheduleResolverLabel(
  status: string,
  displayName: string | null | undefined,
): string | null {
  if (status === 'withdrawn') return 'Withdrawn by customer';

  const who = displayName?.trim() || 'Staff member';
  if (status === 'completed') return `Approved by ${who}`;
  if (status === 'declined') return `Declined by ${who}`;
  return null;
}

type HistoryRow = {
  status: string;
  original_starts_at: string | null;
  original_ends_at: string | null;
  preferred_starts_at: string | null;
  preferred_ends_at: string | null;
  applied_starts_at: string | null;
  applied_ends_at: string | null;
  tenant_scheduled_visits: { starts_at: string; ends_at: string } | null;
};

export function buildRescheduleHistoryTimes(
  row: HistoryRow,
  timezone: string,
): RescheduleHistoryTimes {
  const visit = row.tenant_scheduled_visits;
  const visitNow =
    visit != null ? formatVisitTimeRange(visit.starts_at, visit.ends_at, timezone) : null;

  const fromLabel =
    formatVisitTimeRange(row.original_starts_at, row.original_ends_at, timezone) ??
    (row.status === 'declined' ? visitNow : null);

  const requestedLabel = formatVisitTimeRange(
    row.preferred_starts_at,
    row.preferred_ends_at,
    timezone,
  );

  const missingOriginalNote =
    !fromLabel && row.status !== 'pending'
      ? 'Original appointment time was not recorded for this request.'
      : null;

  if (row.status === 'completed') {
    const toLabel =
      formatVisitTimeRange(row.applied_starts_at, row.applied_ends_at, timezone) ??
      requestedLabel ??
      visitNow;

    return { fromLabel, requestedLabel, toLabel, outcomeNote: null, missingOriginalNote };
  }

  if (row.status === 'declined') {
    return {
      fromLabel,
      requestedLabel,
      toLabel: null,
      outcomeNote: 'Declined — visit was not rescheduled.',
      missingOriginalNote,
    };
  }

  return {
    fromLabel,
    requestedLabel,
    toLabel: null,
    outcomeNote: null,
    missingOriginalNote,
  };
}
