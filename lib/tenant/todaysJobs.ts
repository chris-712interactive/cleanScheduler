import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calendarDateKeyInTimeZone,
  visitTouchesCalendarDayInTimeZone,
} from '@/lib/datetime/tenantCalendarDay';
import { DEFAULT_TENANT_TIMEZONE } from '@/lib/datetime/formatInTimeZone';
import { dbOverlapRangeForQuery } from '@/lib/tenant/scheduleDateRange';
import type { Database } from '@/lib/supabase/database.types';

type VisitRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

export type TodaysJobsSummary = {
  count: number;
  scheduledCount: number;
  completedCount: number;
  todayKey: string;
  timeZone: string;
};

export async function getTenantTodaysJobsSummary(
  db: SupabaseClient<Database>,
  tenantId: string,
): Promise<TodaysJobsSummary> {
  const { data: tenantRow } = await db
    .from('tenants')
    .select('timezone')
    .eq('id', tenantId)
    .maybeSingle();

  const timeZone = tenantRow?.timezone ?? DEFAULT_TENANT_TIMEZONE;
  const todayKey = calendarDateKeyInTimeZone(timeZone);
  const range = dbOverlapRangeForQuery('day', todayKey);

  const { data, error } = await db
    .from('tenant_scheduled_visits')
    .select('id, starts_at, ends_at, status')
    .eq('tenant_id', tenantId)
    .neq('status', 'cancelled')
    .lte('starts_at', range.end)
    .gte('ends_at', range.start);

  if (error || !data) {
    return {
      count: 0,
      scheduledCount: 0,
      completedCount: 0,
      todayKey,
      timeZone,
    };
  }

  const todayVisits = (data as VisitRow[]).filter((v) =>
    visitTouchesCalendarDayInTimeZone(v, todayKey, timeZone),
  );

  return {
    count: todayVisits.length,
    scheduledCount: todayVisits.filter((v) => v.status === 'scheduled').length,
    completedCount: todayVisits.filter((v) => v.status === 'completed').length,
    todayKey,
    timeZone,
  };
}
