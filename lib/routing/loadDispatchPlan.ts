import type { SupabaseClient } from '@supabase/supabase-js';
import { routingFeaturesForPlan, type EntitlementPlanKey } from '@/lib/billing/entitlements';
import { visitTouchesCalendarDayInTimeZone } from '@/lib/datetime/tenantCalendarDay';
import {
  effectiveSchedulingFacts,
  schedulingFactsFromRow,
  type SchedulingFactsRow,
} from '@/lib/schedule/optimizer/preferences';
import {
  dayMapCleanerColor,
  dayMapMissingReasonLabel,
  describeDayMapVisit,
} from '@/lib/schedule/dayMap';
import { loadDayMapRows } from '@/lib/schedule/loadDayMap';
import { loadEffectiveSchedulesForMembers } from '@/lib/schedule/memberScheduleProfile';
import { schedulesVisitKind } from '@/lib/schedule/scheduleEligibility';
import type { Database } from '@/lib/supabase/database.types';
import type { TenantRole } from '@/lib/auth/types';
import { createFleetOptimizer } from '@/lib/routing/fleetOptimizer';
import {
  clockToSeconds,
  dispatchFingerprint,
  dispatchPlanKey,
  localDayInterval,
  type DispatchCleanerInput,
  type DispatchPlanResult,
  type DispatchSnapshotVisit,
  type DispatchVisitInput,
} from '@/lib/routing/dispatchPlan';
import { formatStraightLineMiles } from '@/lib/routing/haversineOptimizer';
import { hasFixedArrivalWindow, isVisitTimeLocked } from '@/lib/routing/locks';
import { driveMetricText } from '@/lib/routing/panelCopy';
import { loadRouteBaseRows, resolveCleanerBase } from '@/lib/routing/routeBases';
import { optimizeDayFingerprint } from '@/lib/routing/reoptimize';
import { usablePoint } from '@/lib/routing/engineOptimizer';
import type { WorkWeekDayKey } from '@/lib/tenant/tenantBusinessSettings';

const EMPTY_FACTS: SchedulingFactsRow = {
  preferred_user_ids: [],
  required_user_ids: [],
  blocked_user_ids: [],
  arrival_start: null,
  arrival_end: null,
  access_start: null,
  access_end: null,
  pet_in_home: false,
  chemical_sensitivity: false,
  language_codes: [],
  required_attribute_tags: [],
  priority: 3,
  required_skill_tags: [],
  required_certification_tags: [],
  required_equipment_tags: [],
  requires_key_pickup: false,
  preferred_weekdays: [],
  preferred_time_window: null,
};

const WEEKDAYS: WorkWeekDayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export type DispatchStopView = {
  id: string;
  title: string;
  customerName: string;
  locked: boolean;
  team: boolean;
};

export type DispatchCleanerView = {
  id: string;
  name: string;
  color: string;
  milesLabel: string;
  driveLabel: string | null;
  stops: DispatchStopView[];
};

export type DispatchDayView = {
  dateKey: string;
  estimateKind: 'straight-line' | 'drive';
  sequenceAvailable: boolean;
  fingerprint: string;
  planKey: string;
  totalMilesLabel: string;
  totalDriveLabel: string | null;
  cleaners: DispatchCleanerView[];
  unassigned: Array<DispatchStopView & { reason: string }>;
  saved: boolean;
  /** Rows the apply function locks and compares. */
  snapshot: DispatchSnapshotVisit[];
  plan: DispatchPlanResult;
  /** Finished, in-progress, and locked visits. Re-optimize does not move these. */
  fixedVisitIds: string[];
  /** Day hash that ignores updated_at, so an apply does not look like a new change. */
  changeFingerprint: string;
};

function weekdayKey(dateKey: string): WorkWeekDayKey {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return 'mon';
  const noon = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  return WEEKDAYS[noon.getUTCDay()] ?? 'mon';
}

function dateKeyInZone(iso: string, timeZone: string): string | null {
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const key = `${read('year')}-${read('month')}-${read('day')}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

function clipTimeOff(
  startsAt: string,
  endsAt: string,
  dateKey: string,
  timeZone: string,
): { startSec: number; endSec: number } | null {
  const interval = localDayInterval(startsAt, endsAt, timeZone);
  const startKey = dateKeyInZone(startsAt, timeZone);
  const endKey = dateKeyInZone(endsAt, timeZone);
  if (!interval || !startKey || !endKey) return null;
  if (endKey < dateKey || startKey > dateKey) return null;
  const startSec = startKey < dateKey ? 0 : interval.startSec;
  const endSec = endKey > dateKey ? 86400 : interval.endSec;
  if (endSec <= startSec) return null;
  return { startSec, endSec };
}

export async function loadDispatchPlan(params: {
  supabase: SupabaseClient<Database>;
  tenantId: string;
  dateKey: string;
  timeZone: string;
  plan: EntitlementPlanKey;
}): Promise<DispatchDayView | null> {
  const tenantId = params.tenantId.trim();
  if (!tenantId) return null;
  const access = routingFeaturesForPlan(params.plan);
  if (!access.multiCleanerDispatch && !access.routeReoptimization) return null;

  const [loaded, tenantResult, preferenceResult, memberResult, timeOffResult] = await Promise.all([
    loadDayMapRows({ supabase: params.supabase, tenantId, dateKey: params.dateKey }),
    params.supabase.from('tenants').select('latitude, longitude').eq('id', tenantId).maybeSingle(),
    params.supabase
      .from('tenant_customer_scheduling_preferences')
      .select('customer_id, arrival_start, arrival_end, required_user_ids, blocked_user_ids')
      .eq('tenant_id', tenantId),
    params.supabase
      .from('tenant_memberships')
      .select('user_id, role, exclude_from_job_schedule, exclude_from_consultation_schedule')
      .eq('tenant_id', tenantId)
      .eq('is_active', true),
    params.supabase
      .from('tenant_member_time_off')
      .select('user_id, starts_at, ends_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'approved'),
  ]);

  if (tenantResult.error) throw new Error(tenantResult.error.message);
  if (preferenceResult.error) throw new Error(preferenceResult.error.message);
  if (memberResult.error) throw new Error(memberResult.error.message);
  if (timeOffResult.error) throw new Error(timeOffResult.error.message);

  const crew = (memberResult.data ?? []).filter((member) =>
    schedulesVisitKind(
      {
        role: member.role as TenantRole,
        excludeFromJobs: member.exclude_from_job_schedule,
        excludeFromConsultations: member.exclude_from_consultation_schedule,
      },
      'service',
    ),
  );
  const crewIds = crew.map((member) => member.user_id);
  const schedules = await loadEffectiveSchedulesForMembers(params.supabase, tenantId, crewIds);
  const { data: profiles, error: profileError } =
    crewIds.length > 0
      ? await params.supabase
          .from('user_profiles')
          .select('user_id, display_name')
          .in('user_id', crewIds)
      : { data: [] as { user_id: string; display_name: string | null }[], error: null };
  if (profileError) throw new Error(profileError.message);
  const nameById = new Map(
    (profiles ?? []).map((profile) => [profile.user_id, profile.display_name?.trim() || 'Cleaner']),
  );

  const [routeBases, homeResult, capResult] = await Promise.all([
    access.multipleStartLocations
      ? loadRouteBaseRows(params.supabase, tenantId)
      : Promise.resolve(null),
    access.multipleStartLocations && crewIds.length > 0
      ? params.supabase
          .from('tenant_member_scheduling_profiles')
          .select('user_id, home_latitude, home_longitude')
          .eq('tenant_id', tenantId)
          .in('user_id', crewIds)
      : Promise.resolve({ data: [], error: null }),
    crewIds.length > 0
      ? params.supabase
          .from('tenant_member_scheduling_profiles')
          .select('user_id, max_jobs_per_day')
          .eq('tenant_id', tenantId)
          .in('user_id', crewIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (homeResult.error) throw new Error(homeResult.error.message);
  if (capResult.error) throw new Error(capResult.error.message);
  const capById = new Map((capResult.data ?? []).map((row) => [row.user_id, row.max_jobs_per_day]));
  const homeById = new Map(
    (homeResult.data ?? []).map((row) => [
      row.user_id,
      row.home_latitude != null && row.home_longitude != null
        ? usablePoint({ lat: row.home_latitude, lng: row.home_longitude })
        : null,
    ]),
  );

  const officeLat = tenantResult.data?.latitude;
  const officeLng = tenantResult.data?.longitude;
  const officePoint =
    officeLat != null &&
    officeLng != null &&
    Number.isFinite(officeLat) &&
    Number.isFinite(officeLng)
      ? { lat: officeLat, lng: officeLng }
      : null;

  const day = weekdayKey(params.dateKey);
  const cleaners: DispatchCleanerInput[] = crewIds.map((id) => {
    const window = schedules.get(id)?.dayWindows[day];
    const start = window ? clockToSeconds(window.startsAt) : null;
    const end = window ? clockToSeconds(window.endsAt) : null;
    const timeOff = (timeOffResult.data ?? [])
      .filter((row) => row.user_id === id)
      .map((row) => clipTimeOff(row.starts_at, row.ends_at, params.dateKey, params.timeZone))
      .filter((span): span is { startSec: number; endSec: number } => span != null);
    const base = resolveCleanerBase({
      userId: id,
      serviceDate: params.dateKey,
      bases: routeBases?.bases ?? [],
      office: officePoint,
      home: homeById.get(id) ?? null,
      locations: routeBases?.locations ?? [],
    });
    return {
      id,
      shiftStartSec: start,
      shiftEndSec: end != null && start != null && end > start ? end : null,
      timeOff,
      start: base.start,
      end: base.end,
      maxJobsPerDay: capById.get(id) ?? null,
    };
  });

  const preferences = new Map((preferenceResult.data ?? []).map((row) => [row.customer_id, row]));
  const office = officePoint;

  const rows = loaded.rows
    .filter((row) => row.tenant_id === tenantId)
    .filter((row) => row.status === 'scheduled' || row.status === 'completed')
    .filter((row) =>
      visitTouchesCalendarDayInTimeZone(
        { starts_at: row.starts_at, ends_at: row.ends_at },
        params.dateKey,
        params.timeZone,
      ),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id));

  const detail = new Map(
    rows.map((row) => {
      const described = describeDayMapVisit(row, tenantId);
      const preference = preferences.get(row.customer_id);
      const facts = effectiveSchedulingFacts(
        schedulingFactsFromRow({
          ...EMPTY_FACTS,
          arrival_start: preference?.arrival_start ?? null,
          arrival_end: preference?.arrival_end ?? null,
          required_user_ids: preference?.required_user_ids ?? [],
          blocked_user_ids: preference?.blocked_user_ids ?? [],
        }),
        described.schedulingOverride,
      );
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
      const team = described.assigneeUserIds.length > 1;
      return [
        row.id,
        {
          title: row.title.trim() || 'Visit',
          customerName: described.customerName,
          locked,
          team,
          point: described.point
            ? { lat: described.point.latitude, lng: described.point.longitude }
            : null,
          reason: dayMapMissingReasonLabel({
            hasProperty: described.hasProperty,
            geocodeReason: described.geocodeReason,
          }),
          assigneeIds: described.assigneeUserIds,
          requiredCleanerIds: facts.requiredUserIds,
          blockedCleanerIds: facts.blockedUserIds,
          routeSequence: loaded.routeSequenceAvailable ? (row.route_sequence ?? null) : null,
        },
      ] as const;
    }),
  );

  const visitInputs: DispatchVisitInput[] = [];
  for (const row of rows) {
    const info = detail.get(row.id);
    const interval = localDayInterval(row.starts_at, row.ends_at, params.timeZone);
    if (!info || !interval) continue;
    visitInputs.push({
      id: row.id,
      point: info.point,
      missingReason: info.reason,
      pinned: info.locked || info.team,
      lockedAt: info.locked ? Date.parse(row.starts_at) : null,
      startSec: interval.startSec,
      endSec: interval.endSec,
      assigneeIds: info.assigneeIds,
      requiredCleanerIds: info.requiredCleanerIds,
      blockedCleanerIds: info.blockedCleanerIds,
    });
  }

  const idList = visitInputs.map((visit) => visit.id);
  const { data: stamps, error: stampError } =
    idList.length > 0
      ? await params.supabase
          .from('tenant_scheduled_visits')
          .select('id, updated_at, starts_at, ends_at, status, checked_in_at')
          .eq('tenant_id', tenantId)
          .in('id', idList)
      : { data: [], error: null };
  if (stampError) throw new Error(stampError.message);
  const stampById = new Map((stamps ?? []).map((row) => [row.id, row]));

  const plan = await createFleetOptimizer().optimize({
    visits: visitInputs,
    cleaners,
    office,
  });

  const snapshot: DispatchSnapshotVisit[] = visitInputs.map((visit) => {
    const stamp = stampById.get(visit.id);
    const info = detail.get(visit.id);
    return {
      id: visit.id,
      startsAt: stamp?.starts_at ?? '',
      endsAt: stamp?.ends_at ?? '',
      status: stamp?.status ?? '',
      checkedInAt: stamp?.checked_in_at ?? null,
      routeSequence: info?.routeSequence ?? null,
      updatedAt: stamp?.updated_at ?? '',
      assigneeIds: info?.assigneeIds ?? [],
    };
  });

  const stopOf = (id: string): DispatchStopView => {
    const info = detail.get(id);
    return {
      id,
      title: info?.title ?? 'Visit',
      customerName: info?.customerName ?? 'Customer',
      locked: info?.locked ?? false,
      team: info?.team ?? false,
    };
  };

  const colorByCleaner = new Map<string, string>();
  let colorIndex = 0;
  for (const row of rows) {
    const cleanerId = plan.assignments.find((assignment) =>
      assignment.orderedIds.includes(row.id),
    )?.cleanerId;
    if (!cleanerId || colorByCleaner.has(cleanerId)) continue;
    colorByCleaner.set(cleanerId, dayMapCleanerColor(colorIndex));
    colorIndex += 1;
  }
  for (const cleaner of plan.assignments) {
    if (colorByCleaner.has(cleaner.cleanerId)) continue;
    colorByCleaner.set(cleaner.cleanerId, dayMapCleanerColor(colorIndex));
    colorIndex += 1;
  }

  const cleanersView: DispatchCleanerView[] = plan.assignments.map((assignment) => ({
    id: assignment.cleanerId,
    name: nameById.get(assignment.cleanerId) || 'Cleaner',
    color: colorByCleaner.get(assignment.cleanerId) ?? dayMapCleanerColor(0),
    milesLabel: formatStraightLineMiles(assignment.estimatedMiles),
    driveLabel:
      plan.estimateKind === 'drive' && assignment.driveSeconds != null
        ? driveMetricText(assignment.driveSeconds, assignment.estimatedMiles)
        : null,
    stops: assignment.orderedIds.map(stopOf),
  }));

  const totalMiles = plan.assignments.reduce((sum, row) => sum + row.estimatedMiles, 0);
  const totalSeconds = plan.assignments.reduce((sum, row) => sum + (row.driveSeconds ?? 0), 0);
  const saved =
    loaded.routeSequenceAvailable &&
    plan.visits.length > 0 &&
    plan.visits.every((visit) => {
      const info = detail.get(visit.id);
      if (!info) return false;
      if ((info.routeSequence ?? null) !== (visit.routeSequence ?? null)) return false;
      if (!visit.changeAssignees) return true;
      const next = [...visit.assigneeIds].sort().join(',');
      const have = [...info.assigneeIds].sort().join(',');
      return next === have;
    });

  const fixedVisitIds = visitInputs
    .filter((visit) => detail.get(visit.id)?.locked)
    .map((visit) => visit.id);
  const timeOffLines = (timeOffResult.data ?? [])
    .filter(
      (row) => clipTimeOff(row.starts_at, row.ends_at, params.dateKey, params.timeZone) != null,
    )
    .map((row) => ({ userId: row.user_id, startsAt: row.starts_at, endsAt: row.ends_at }));
  const changeFingerprint = optimizeDayFingerprint({
    visits: snapshot.map((row) => ({
      id: row.id,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      status: row.status,
      checkedInAt: row.checkedInAt,
      routeSequence: row.routeSequence,
      assigneeIds: row.assigneeIds,
    })),
    timeOff: timeOffLines,
  });

  return {
    dateKey: params.dateKey,
    estimateKind: plan.estimateKind,
    sequenceAvailable: loaded.routeSequenceAvailable,
    fingerprint: dispatchFingerprint(snapshot),
    planKey: dispatchPlanKey(plan),
    totalMilesLabel: formatStraightLineMiles(totalMiles),
    totalDriveLabel:
      plan.estimateKind === 'drive' ? driveMetricText(totalSeconds, totalMiles) : null,
    cleaners: cleanersView,
    unassigned: plan.unassigned.map((row) => ({ ...stopOf(row.id), reason: row.reason })),
    saved,
    snapshot,
    plan,
    fixedVisitIds,
    changeFingerprint,
  };
}
