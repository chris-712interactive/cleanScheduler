import type { SupabaseClient } from '@supabase/supabase-js';
import { visitTouchesCalendarDayInTimeZone } from '@/lib/datetime/tenantCalendarDay';
import {
  isMissingRelationError,
  type RouteEndKind,
  type RouteStartKind,
} from '@/lib/routing/routeBases';
import { optimizeDayFingerprint, type OptimizeTimeOff } from '@/lib/routing/reoptimize';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

export type AppliedRouteStatInput = {
  userId: string;
  estimateKind: 'straight-line' | 'drive';
  miles: number;
  driveSeconds: number | null;
  stopCount: number;
};

function roundMiles(miles: number): number {
  if (!Number.isFinite(miles) || miles < 0) return 0;
  return Math.round(miles * 10) / 10;
}

async function dayVisits(admin: Admin, tenantId: string, serviceDate: string, timeZone: string) {
  const { data, error } = await admin
    .from('tenant_scheduled_visits')
    .select('id, starts_at, ends_at, status, checked_in_at, route_sequence, tenant_id')
    .eq('tenant_id', tenantId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []).filter(
    (row) =>
      row.tenant_id === tenantId &&
      (row.status === 'scheduled' || row.status === 'completed') &&
      visitTouchesCalendarDayInTimeZone(
        { starts_at: row.starts_at, ends_at: row.ends_at },
        serviceDate,
        timeZone,
      ),
  );
  const ids = rows.map((row) => row.id);
  const { data: assignees, error: assigneeError } =
    ids.length > 0
      ? await admin
          .from('tenant_scheduled_visit_assignees')
          .select('visit_id, user_id')
          .in('visit_id', ids)
      : { data: [], error: null };
  if (assigneeError) throw new Error(assigneeError.message);
  const byVisit = new Map<string, string[]>();
  for (const row of assignees ?? []) {
    const list = byVisit.get(row.visit_id) ?? [];
    list.push(row.user_id);
    byVisit.set(row.visit_id, list);
  }
  return rows.map((row) => ({
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    checkedInAt: row.checked_in_at,
    routeSequence: row.route_sequence,
    assigneeIds: byVisit.get(row.id) ?? [],
  }));
}

async function dayTimeOff(
  admin: Admin,
  tenantId: string,
  serviceDate: string,
  timeZone: string,
): Promise<OptimizeTimeOff[]> {
  const { data, error } = await admin
    .from('tenant_member_time_off')
    .select('user_id, starts_at, ends_at, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'approved');
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((row) =>
      visitTouchesCalendarDayInTimeZone(
        { starts_at: row.starts_at, ends_at: row.ends_at },
        serviceDate,
        timeZone,
      ),
    )
    .map((row) => ({ userId: row.user_id, startsAt: row.starts_at, endsAt: row.ends_at }));
}

/**
 * Writes the miles saved at Apply. A missing migration leaves the schedule save alone.
 * `replace` drops cleaners who no longer have stops that day.
 */
export async function recordAppliedRouteDay(
  admin: Admin,
  input: {
    tenantId: string;
    serviceDate: string;
    timeZone: string;
    stats: readonly AppliedRouteStatInput[];
    replace: boolean;
  },
): Promise<boolean> {
  let fingerprint = '';
  try {
    const [visits, timeOff] = await Promise.all([
      dayVisits(admin, input.tenantId, input.serviceDate, input.timeZone),
      dayTimeOff(admin, input.tenantId, input.serviceDate, input.timeZone),
    ]);
    fingerprint = optimizeDayFingerprint({ visits, timeOff });
  } catch (error) {
    console.error(
      '[routing] could not fingerprint the day:',
      error instanceof Error ? error.message : 'unknown',
    );
    return false;
  }

  const rows = input.stats.map((row) => ({
    tenant_id: input.tenantId,
    service_date: input.serviceDate,
    user_id: row.userId,
    estimate_kind: row.estimateKind,
    miles: roundMiles(row.miles),
    drive_seconds:
      row.estimateKind === 'drive' ? Math.max(0, Math.round(row.driveSeconds ?? 0)) : null,
    stop_count: Math.max(0, Math.round(row.stopCount)),
    day_fingerprint: fingerprint,
    applied_at: new Date().toISOString(),
  }));

  if (rows.length > 0) {
    const { error } = await admin.from('tenant_applied_route_days').upsert(rows, {
      onConflict: 'tenant_id,service_date,user_id',
    });
    if (error) {
      if (isMissingRelationError(error)) return false;
      console.error('[routing] could not save drive time:', error.message);
      return false;
    }
  }

  const { error: stampError } = await admin
    .from('tenant_applied_route_days')
    .update({ day_fingerprint: fingerprint })
    .eq('tenant_id', input.tenantId)
    .eq('service_date', input.serviceDate);
  if (stampError) {
    if (isMissingRelationError(stampError)) return false;
    console.error('[routing] could not stamp the day:', stampError.message);
    return false;
  }

  if (input.replace) {
    const keep = new Set(input.stats.map((row) => row.userId));
    const { data: existing, error: readError } = await admin
      .from('tenant_applied_route_days')
      .select('user_id')
      .eq('tenant_id', input.tenantId)
      .eq('service_date', input.serviceDate);
    if (readError) {
      if (isMissingRelationError(readError)) return false;
      return true;
    }
    const drop = (existing ?? []).map((row) => row.user_id).filter((id) => !keep.has(id));
    if (drop.length > 0) {
      await admin
        .from('tenant_applied_route_days')
        .delete()
        .eq('tenant_id', input.tenantId)
        .eq('service_date', input.serviceDate)
        .in('user_id', drop);
    }
  }
  return true;
}

export async function loadSavedRouteFingerprint(
  admin: Admin,
  tenantId: string,
  serviceDate: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('tenant_applied_route_days')
    .select('day_fingerprint')
    .eq('tenant_id', tenantId)
    .eq('service_date', serviceDate)
    .limit(1);
  if (error) {
    if (isMissingRelationError(error)) return null;
    throw new Error(error.message);
  }
  return data?.[0]?.day_fingerprint ?? null;
}

export type RouteBaseWrite = {
  userId: string;
  serviceDate: string | null;
  startKind: RouteStartKind;
  startLocationId: string | null;
  endKind: RouteEndKind;
  endLocationId: string | null;
};
