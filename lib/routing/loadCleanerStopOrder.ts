import type { SupabaseClient } from '@supabase/supabase-js';
import { routingFeaturesForPlan, type EntitlementPlanKey } from '@/lib/billing/entitlements';
import type { Database } from '@/lib/supabase/database.types';
import { visitTouchesCalendarDayInTimeZone } from '@/lib/datetime/tenantCalendarDay';
import { dayMapMissingReasonLabel, describeDayMapVisit } from '@/lib/schedule/dayMap';
import { loadDayMapRows } from '@/lib/schedule/loadDayMap';
import { createRouteOptimizer } from '@/lib/routing/createRouteOptimizer';
import { usablePoint } from '@/lib/routing/engineOptimizer';
import { formatStraightLineMiles } from '@/lib/routing/haversineOptimizer';
import { loadRouteBaseRows, resolveCleanerBase } from '@/lib/routing/routeBases';
import { driveMetricText } from '@/lib/routing/panelCopy';
import { hasFixedArrivalWindow, isVisitTimeLocked } from '@/lib/routing/locks';
import type { CleanerStopOrderView, RouteStopInput } from '@/lib/routing/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type PreferenceRow = {
  customer_id: string;
  arrival_start: string | null;
  arrival_end: string | null;
};

export async function loadCleanerStopOrder(params: {
  supabase: SupabaseClient<Database>;
  tenantId: string;
  dateKey: string;
  timeZone: string;
  cleanerUserId: string;
  cleanerName: string;
  plan: EntitlementPlanKey;
}): Promise<CleanerStopOrderView | null> {
  const tenantId = params.tenantId.trim();
  const cleanerUserId = params.cleanerUserId.trim();
  if (!tenantId || !UUID_RE.test(cleanerUserId)) return null;
  const access = routingFeaturesForPlan(params.plan);
  if (!access.singleCleanerStopOrdering) return null;

  const [loaded, tenantResult, preferenceResult, routeBases, homeResult] = await Promise.all([
    loadDayMapRows({
      supabase: params.supabase,
      tenantId,
      dateKey: params.dateKey,
    }),
    params.supabase.from('tenants').select('latitude, longitude').eq('id', tenantId).maybeSingle(),
    params.supabase
      .from('tenant_customer_scheduling_preferences')
      .select('customer_id, arrival_start, arrival_end')
      .eq('tenant_id', tenantId),
    access.multipleStartLocations
      ? loadRouteBaseRows(params.supabase, tenantId)
      : Promise.resolve(null),
    access.multipleStartLocations
      ? params.supabase
          .from('tenant_member_scheduling_profiles')
          .select('user_id, home_latitude, home_longitude')
          .eq('tenant_id', tenantId)
          .eq('user_id', cleanerUserId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (tenantResult.error) throw new Error(tenantResult.error.message);
  if (preferenceResult.error) throw new Error(preferenceResult.error.message);
  if (homeResult.error) throw new Error(homeResult.error.message);

  const preferences = new Map<string, PreferenceRow>();
  for (const row of (preferenceResult.data ?? []) as PreferenceRow[]) {
    preferences.set(row.customer_id, row);
  }

  const rows = loaded.rows;
  const officeLat = tenantResult.data?.latitude;
  const officeLng = tenantResult.data?.longitude;
  const office =
    officeLat != null &&
    officeLng != null &&
    Number.isFinite(officeLat) &&
    Number.isFinite(officeLng)
      ? { lat: officeLat, lng: officeLng }
      : null;
  const home =
    homeResult.data?.home_latitude != null && homeResult.data.home_longitude != null
      ? usablePoint({ lat: homeResult.data.home_latitude, lng: homeResult.data.home_longitude })
      : null;
  const base = resolveCleanerBase({
    userId: cleanerUserId,
    serviceDate: params.dateKey,
    bases: routeBases?.bases ?? [],
    office,
    home,
    locations: routeBases?.locations ?? [],
  });
  const start = base.start ?? office;

  const candidates = rows
    .filter((row) => row.tenant_id === tenantId)
    .filter((row) => row.status === 'scheduled' || row.status === 'completed')
    .filter((row) =>
      visitTouchesCalendarDayInTimeZone(
        { starts_at: row.starts_at, ends_at: row.ends_at },
        params.dateKey,
        params.timeZone,
      ),
    )
    .filter((row) => describeDayMapVisit(row, tenantId).assigneeUserIds.includes(cleanerUserId))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id));

  const details = new Map(
    candidates.map((row) => {
      const described = describeDayMapVisit(row, tenantId);
      const preference = preferences.get(row.customer_id);
      const fixedWindow = hasFixedArrivalWindow({
        arrivalStart: preference?.arrival_start ?? null,
        arrivalEnd: preference?.arrival_end ?? null,
        schedulingOverride: described.schedulingOverride,
      });
      const locked = isVisitTimeLocked({
        status: row.status,
        checkedInAt: row.checked_in_at ?? null,
        visitPurpose: row.visit_purpose ?? null,
        hasFixedArrivalWindow: fixedWindow,
      });
      const reason = dayMapMissingReasonLabel({
        hasProperty: described.hasProperty,
        geocodeReason: described.geocodeReason,
      });
      return [
        row.id,
        {
          id: row.id,
          title: row.title.trim() || 'Visit',
          customerName: described.customerName,
          locked,
          reason,
          point: described.point
            ? { lat: described.point.latitude, lng: described.point.longitude }
            : null,
          lockedAt: locked ? Date.parse(row.starts_at) : null,
          routeSequence: loaded.routeSequenceAvailable ? (row.route_sequence ?? null) : null,
        },
      ] as const;
    }),
  );

  const stops: RouteStopInput[] = candidates.map((row) => {
    const detail = details.get(row.id);
    return {
      id: row.id,
      point: detail?.point ?? null,
      lockedAt: detail?.lockedAt ?? null,
      missingReason: detail?.reason ?? 'Missing map point',
    };
  });

  const optimized = await createRouteOptimizer().optimize({
    stops,
    start,
    end: base.end,
  });
  const line = (id: string) => {
    const detail = details.get(id);
    return {
      id,
      title: detail?.title ?? 'Visit',
      customerName: detail?.customerName ?? 'Customer',
      locked: detail?.locked ?? false,
    };
  };
  const ordered = optimized.orderedIds.map(line);
  const unrouted = optimized.unrouted.map((item) => ({
    ...line(item.id),
    reason: item.reason,
  }));
  const saved =
    loaded.routeSequenceAvailable &&
    ordered.length > 0 &&
    ordered.every((item, index) => details.get(item.id)?.routeSequence === index + 1) &&
    unrouted.every((item) => details.get(item.id)?.routeSequence == null);

  return {
    cleanerUserId,
    cleanerName: params.cleanerName.trim() || 'Cleaner',
    dateKey: params.dateKey,
    startLabel: start ? base.startLabel : 'First stop',
    estimateKind: optimized.estimateKind,
    estimatedMilesBefore: optimized.estimatedMilesBefore,
    estimatedMilesAfter: optimized.estimatedMilesAfter,
    beforeLabel: formatStraightLineMiles(optimized.estimatedMilesBefore),
    afterLabel: formatStraightLineMiles(optimized.estimatedMilesAfter),
    driveBeforeLabel:
      optimized.estimateKind === 'drive' && optimized.driveSecondsBefore != null
        ? driveMetricText(optimized.driveSecondsBefore, optimized.estimatedMilesBefore)
        : null,
    driveAfterLabel:
      optimized.estimateKind === 'drive' && optimized.driveSecondsAfter != null
        ? driveMetricText(optimized.driveSecondsAfter, optimized.estimatedMilesAfter)
        : null,
    driveSecondsAfter: optimized.estimateKind === 'drive' ? optimized.driveSecondsAfter : null,
    ordered,
    unrouted,
    saved,
    sequenceAvailable: loaded.routeSequenceAvailable,
  };
}
