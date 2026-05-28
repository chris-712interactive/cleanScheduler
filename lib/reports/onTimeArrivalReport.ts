import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { ReportSummaryLine } from '@/lib/reports/types';

const ON_TIME_GRACE_MS = 15 * 60 * 1000;

export interface OnTimeArrivalRow {
  visitId: string;
  title: string;
  scheduledStart: string;
  checkedInAt: string | null;
  minutesLate: number | null;
  onTime: boolean;
}

export interface OnTimeArrivalResult {
  rows: OnTimeArrivalRow[];
  summary: ReportSummaryLine[];
}

export async function runOnTimeArrivalReport(
  db: SupabaseClient<Database>,
  tenantId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<OnTimeArrivalResult> {
  let visitQuery = db
    .from('tenant_scheduled_visits')
    .select('id, title, starts_at, checked_in_at, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'completed');

  if (fromIso) visitQuery = visitQuery.gte('completed_at', fromIso);
  if (toIso) visitQuery = visitQuery.lte('completed_at', toIso);

  const { data: visits, error } = await visitQuery;
  if (error || !visits?.length) {
    return {
      rows: [],
      summary: [
        { label: 'On-time rate', value: '—' },
        { label: 'Grace window', value: '15 minutes' },
      ],
    };
  }

  const rows: OnTimeArrivalRow[] = visits.map((visit) => {
    const startMs = new Date(visit.starts_at).getTime();
    const checkMs = visit.checked_in_at ? new Date(visit.checked_in_at).getTime() : null;
    const onTime = checkMs != null && checkMs <= startMs + ON_TIME_GRACE_MS;
    const minutesLate =
      checkMs != null && checkMs > startMs + ON_TIME_GRACE_MS
        ? Math.round((checkMs - startMs) / 60_000)
        : checkMs == null
          ? null
          : 0;

    return {
      visitId: visit.id,
      title: visit.title,
      scheduledStart: visit.starts_at,
      checkedInAt: visit.checked_in_at,
      minutesLate,
      onTime: checkMs != null ? onTime : false,
    };
  });

  const withCheckIn = rows.filter((r) => r.checkedInAt != null);
  const onTimeCount = withCheckIn.filter((r) => r.onTime).length;
  const rate = withCheckIn.length > 0 ? Math.round((onTimeCount / withCheckIn.length) * 100) : 0;

  rows.sort((a, b) => {
    const aLate = a.minutesLate ?? -1;
    const bLate = b.minutesLate ?? -1;
    return bLate - aLate;
  });

  return {
    rows,
    summary: [
      {
        label: 'On-time rate',
        value: withCheckIn.length > 0 ? `${rate}%` : '—',
      },
      { label: 'Jobs with check-in', value: String(withCheckIn.length) },
      { label: 'No check-in', value: String(rows.length - withCheckIn.length) },
    ],
  };
}
