import type { SupabaseClient } from '@supabase/supabase-js';
import {
  computeInstantSlots,
  type InstantSlot,
  type InstantSlotBusy,
} from '@/lib/booking/computeInstantSlots';
import { schedulesVisitKind } from '@/lib/schedule/scheduleEligibility';
import type { PlaceHint } from '@/lib/schedule/optimizer/geo';
import { loadEffectiveSchedulesForMembers } from '@/lib/schedule/memberScheduleProfile';
import type { TenantRole } from '@/lib/auth/types';
import type { Database } from '@/lib/supabase/database.types';
import { tenantBusinessSnapshotFromRow } from '@/lib/tenant/tenantBusinessSettings';

type Admin = SupabaseClient<Database>;

export type InstantBookingPolicy = {
  leadTimeHours: number;
  windowDays: number;
  bufferMinutes: number;
  slotStepMinutes: number;
  depositCents: number;
  collectCard: boolean;
  allowRecurring: boolean;
  allowWeekly: boolean;
  allowBiweekly: boolean;
  allowMonthly: boolean;
  travelMph: number;
};

export function instantBookingPolicyFromRow(row: {
  instant_booking_lead_time_hours: number;
  instant_booking_window_days: number;
  instant_booking_buffer_minutes: number;
  instant_booking_slot_step_minutes: number;
  instant_booking_deposit_cents: number;
  instant_booking_collect_card: boolean;
  instant_booking_allow_recurring: boolean;
  instant_booking_allow_weekly: boolean;
  instant_booking_allow_biweekly: boolean;
  instant_booking_allow_monthly: boolean;
  instant_booking_travel_mph: number;
}): InstantBookingPolicy {
  const step = row.instant_booking_slot_step_minutes;
  return {
    leadTimeHours: row.instant_booking_lead_time_hours,
    windowDays: row.instant_booking_window_days,
    bufferMinutes: row.instant_booking_buffer_minutes,
    slotStepMinutes: step === 15 || step === 60 ? step : 30,
    depositCents: row.instant_booking_deposit_cents,
    collectCard: row.instant_booking_collect_card,
    allowRecurring: row.instant_booking_allow_recurring,
    allowWeekly: row.instant_booking_allow_weekly,
    allowBiweekly: row.instant_booking_allow_biweekly,
    allowMonthly: row.instant_booking_allow_monthly,
    travelMph: row.instant_booking_travel_mph,
  };
}

function placeFromProperty(
  row: {
    latitude: number | null;
    longitude: number | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
  } | null,
): PlaceHint | null {
  if (!row) return null;
  const point =
    row.latitude != null && row.longitude != null
      ? { lat: row.latitude, lng: row.longitude }
      : null;
  return {
    point,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
  };
}

export async function loadInstantSlotsForTenant(
  admin: Admin,
  input: {
    tenantId: string;
    policy: InstantBookingPolicy;
    durationMinutes: number;
    destination?: PlaceHint | null;
    now?: Date;
  },
): Promise<{ slots: InstantSlot[]; timezone: string } | { error: string }> {
  const { data: tenantRow, error: tenantError } = await admin
    .from('tenants')
    .select(
      'timezone, work_week_days, work_day_start, work_day_end, work_day_hours, name, business_email, business_phone, brand_color, logo_url, address_line1, city, state, postal_code, country',
    )
    .eq('id', input.tenantId)
    .maybeSingle();

  if (tenantError || !tenantRow) return { error: 'This booking form is not available.' };

  const business = tenantBusinessSnapshotFromRow({
    name: tenantRow.name,
    timezone: tenantRow.timezone,
    business_email: tenantRow.business_email,
    business_phone: tenantRow.business_phone,
    brand_color: tenantRow.brand_color,
    logo_url: tenantRow.logo_url,
    address_line1: tenantRow.address_line1,
    city: tenantRow.city,
    state: tenantRow.state,
    postal_code: tenantRow.postal_code,
    country: tenantRow.country,
    work_week_days: tenantRow.work_week_days,
    work_day_start: tenantRow.work_day_start,
    work_day_end: tenantRow.work_day_end,
    work_day_hours: tenantRow.work_day_hours,
  });

  const { data: members, error: memberError } = await admin
    .from('tenant_memberships')
    .select('user_id, role, exclude_from_job_schedule, exclude_from_consultation_schedule')
    .eq('tenant_id', input.tenantId)
    .eq('is_active', true)
    .in('role', ['employee', 'admin', 'owner']);

  if (memberError) return { error: 'Could not check crew availability.' };

  const userIds = (members ?? [])
    .filter((member) =>
      schedulesVisitKind(
        {
          role: member.role as TenantRole,
          excludeFromJobs: member.exclude_from_job_schedule,
          excludeFromConsultations: member.exclude_from_consultation_schedule,
        },
        'service',
      ),
    )
    .map((member) => member.user_id);

  const schedules = await loadEffectiveSchedulesForMembers(admin, input.tenantId, userIds);
  const crew = userIds.flatMap((userId) => {
    const schedule = schedules.get(userId);
    return schedule ? [{ userId, schedule }] : [];
  });

  const now = input.now ?? new Date();
  const horizonEnd = new Date(
    now.getTime() + (input.policy.windowDays + 1) * 24 * 3_600_000,
  ).toISOString();
  const rangeStart = now.toISOString();

  const [visitsResult, timeOffResult, locksResult] = await Promise.all([
    admin
      .from('tenant_scheduled_visits')
      .select(
        `
        id,
        starts_at,
        ends_at,
        property:tenant_customer_properties ( latitude, longitude, city, state, postal_code ),
        tenant_scheduled_visit_assignees ( user_id )
      `,
      )
      .eq('tenant_id', input.tenantId)
      .eq('status', 'scheduled')
      .lt('starts_at', horizonEnd)
      .gt('ends_at', rangeStart),
    admin
      .from('tenant_member_time_off')
      .select('user_id, starts_at, ends_at')
      .eq('tenant_id', input.tenantId)
      .eq('status', 'approved')
      .lt('starts_at', horizonEnd)
      .gt('ends_at', rangeStart),
    admin
      .from('tenant_booking_slot_locks')
      .select(
        'assignee_user_id, starts_at, ends_at, visit_ends_at, expires_at, place_lat, place_lng, place_city, place_state, place_postal',
      )
      .eq('tenant_id', input.tenantId)
      .lt('starts_at', horizonEnd)
      .gt('ends_at', rangeStart),
  ]);

  if (visitsResult.error || timeOffResult.error || locksResult.error) {
    return { error: 'Could not check crew availability.' };
  }

  const busy: InstantSlotBusy[] = [];

  for (const visit of visitsResult.data ?? []) {
    const property = Array.isArray(visit.property) ? visit.property[0] : visit.property;
    const assignees = visit.tenant_scheduled_visit_assignees ?? [];
    for (const assignee of assignees) {
      busy.push({
        assigneeUserId: assignee.user_id,
        startsAt: visit.starts_at,
        endsAt: visit.ends_at,
        kind: 'visit',
        place: placeFromProperty(property ?? null),
      });
    }
  }

  for (const off of timeOffResult.data ?? []) {
    busy.push({
      assigneeUserId: off.user_id,
      startsAt: off.starts_at,
      endsAt: off.ends_at,
      kind: 'time_off',
    });
  }

  for (const lock of locksResult.data ?? []) {
    if (lock.expires_at && new Date(lock.expires_at).getTime() <= now.getTime()) continue;
    const point =
      lock.place_lat != null && lock.place_lng != null
        ? { lat: lock.place_lat, lng: lock.place_lng }
        : null;
    busy.push({
      assigneeUserId: lock.assignee_user_id,
      startsAt: lock.starts_at,
      endsAt: lock.visit_ends_at ?? lock.ends_at,
      kind: 'lock',
      place: {
        point,
        city: lock.place_city,
        state: lock.place_state,
        postalCode: lock.place_postal,
      },
    });
  }

  const workDayHours = Object.fromEntries(
    business.workDays
      .filter((day) => day.enabled)
      .map((day) => [day.weekday, { start: day.start, end: day.end }]),
  );

  const slots = computeInstantSlots({
    timezone: business.timezone,
    workWeekDays: business.workWeekDays,
    workDayStart: business.workDayStart,
    workDayEnd: business.workDayEnd,
    workDayHours,
    durationMinutes: input.durationMinutes,
    slotStepMinutes: input.policy.slotStepMinutes,
    leadTimeHours: input.policy.leadTimeHours,
    windowDays: input.policy.windowDays,
    bufferMinutes: input.policy.bufferMinutes,
    travelMph: input.policy.travelMph,
    destination: input.destination,
    crew,
    busy,
    now,
  });

  return { slots, timezone: business.timezone };
}
