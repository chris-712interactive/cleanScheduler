import type { SupabaseClient } from '@supabase/supabase-js';
import { visitTimeRangesOverlap } from '@/lib/schedule/visitAssigneeConflicts';
import type { Database } from '@/lib/supabase/database.types';
import {
  loadEffectiveMemberSchedule,
  loadEffectiveSchedulesForMembers,
  type EffectiveMemberSchedule,
} from '@/lib/schedule/memberScheduleProfile';
import type { WorkWeekDayKey } from '@/lib/tenant/tenantBusinessSettings';

type Admin = SupabaseClient<Database>;

export type UnavailabilityReason =
  | 'outside_work_window'
  | 'time_off'
  | 'visit_overlap'
  | 'inactive_member';

export type EmployeeAvailabilityResult = {
  userId: string;
  available: boolean;
  reasons: UnavailabilityReason[];
};

const WEEKDAY_SHORT_TO_KEY: Record<string, WorkWeekDayKey> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
  Sun: 'sun',
};

function calendarPartsInTimeZone(at: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const weekday = read('weekday').slice(0, 3);
  return {
    year: Number(read('year')),
    month: Number(read('month')),
    day: Number(read('day')),
    hour: Number(read('hour')),
    minute: Number(read('minute')),
    dayKey: WEEKDAY_SHORT_TO_KEY[weekday] ?? 'mon',
  };
}

function parseHm(raw: string): { hour: number; minute: number } {
  const match = raw.trim().match(/^(\d{2}):(\d{2})/);
  if (!match) return { hour: 8, minute: 0 };
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function minutesSinceMidnight(hour: number, minute: number): number {
  return hour * 60 + minute;
}

/** Visit must start and end on the same calendar day within configured work hours. */
export function isVisitWithinMemberWorkWindow(
  schedule: EffectiveMemberSchedule,
  startsAt: string,
  endsAt: string,
): boolean {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    return false;
  }

  const startCal = calendarPartsInTimeZone(start, schedule.timezone);
  const endCal = calendarPartsInTimeZone(end, schedule.timezone);

  if (
    startCal.year !== endCal.year ||
    startCal.month !== endCal.month ||
    startCal.day !== endCal.day
  ) {
    return false;
  }

  const dayWindow = schedule.dayWindows[startCal.dayKey];
  if (!dayWindow) {
    return false;
  }

  const workStart = parseHm(dayWindow.startsAt);
  const workEnd = parseHm(dayWindow.endsAt);
  const visitStartMin = minutesSinceMidnight(startCal.hour, startCal.minute);
  const visitEndMin = minutesSinceMidnight(endCal.hour, endCal.minute);
  const workStartMin = minutesSinceMidnight(workStart.hour, workStart.minute);
  const workEndMin = minutesSinceMidnight(workEnd.hour, workEnd.minute);

  return visitStartMin >= workStartMin && visitEndMin <= workEndMin;
}

async function hasApprovedTimeOff(
  admin: Admin,
  tenantId: string,
  userId: string,
  startsAt: string,
  endsAt: string,
): Promise<boolean> {
  const { data } = await admin
    .from('tenant_member_time_off')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('status', 'approved')
    .lt('starts_at', endsAt)
    .gt('ends_at', startsAt)
    .limit(1);

  return (data ?? []).length > 0;
}

async function hasVisitOverlap(
  admin: Admin,
  tenantId: string,
  userId: string,
  startsAt: string,
  endsAt: string,
  excludeVisitId?: string,
): Promise<boolean> {
  let query = admin
    .from('tenant_scheduled_visits')
    .select(
      `
      id,
      starts_at,
      ends_at,
      tenant_scheduled_visit_assignees!inner ( user_id )
    `,
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'scheduled')
    .eq('tenant_scheduled_visit_assignees.user_id', userId)
    .lt('starts_at', endsAt)
    .gt('ends_at', startsAt);

  if (excludeVisitId) {
    query = query.neq('id', excludeVisitId);
  }

  const { data } = await query;
  for (const row of data ?? []) {
    if (visitTimeRangesOverlap(startsAt, endsAt, row.starts_at, row.ends_at)) {
      return true;
    }
  }
  return false;
}

export async function checkEmployeeAvailability(
  admin: Admin,
  params: {
    tenantId: string;
    userId: string;
    startsAt: string;
    endsAt: string;
    excludeVisitId?: string;
    schedule?: EffectiveMemberSchedule;
  },
): Promise<EmployeeAvailabilityResult> {
  const schedule =
    params.schedule ?? (await loadEffectiveMemberSchedule(admin, params.tenantId, params.userId));

  const reasons: UnavailabilityReason[] = [];

  if (!schedule || !isVisitWithinMemberWorkWindow(schedule, params.startsAt, params.endsAt)) {
    reasons.push('outside_work_window');
  }

  if (
    await hasApprovedTimeOff(admin, params.tenantId, params.userId, params.startsAt, params.endsAt)
  ) {
    reasons.push('time_off');
  }

  if (
    await hasVisitOverlap(
      admin,
      params.tenantId,
      params.userId,
      params.startsAt,
      params.endsAt,
      params.excludeVisitId,
    )
  ) {
    reasons.push('visit_overlap');
  }

  return {
    userId: params.userId,
    available: reasons.length === 0,
    reasons,
  };
}

export async function findAvailableEmployees(
  admin: Admin,
  params: {
    tenantId: string;
    startsAt: string;
    endsAt: string;
    userIds: string[];
    excludeVisitId?: string;
  },
): Promise<EmployeeAvailabilityResult[]> {
  const schedules = await loadEffectiveSchedulesForMembers(admin, params.tenantId, params.userIds);

  const results = await Promise.all(
    params.userIds.map((userId) =>
      checkEmployeeAvailability(admin, {
        tenantId: params.tenantId,
        userId,
        startsAt: params.startsAt,
        endsAt: params.endsAt,
        excludeVisitId: params.excludeVisitId,
        schedule: schedules.get(userId),
      }),
    ),
  );

  return results.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return 0;
  });
}

export async function pickAutoAssignEmployee(
  admin: Admin,
  params: {
    tenantId: string;
    startsAt: string;
    endsAt: string;
    excludeVisitId?: string;
  },
): Promise<string | null> {
  const { data: members } = await admin
    .from('tenant_memberships')
    .select('user_id, role')
    .eq('tenant_id', params.tenantId)
    .eq('is_active', true)
    .in('role', ['employee', 'admin', 'owner']);

  const userIds = (members ?? []).map((m) => m.user_id);
  const available = await findAvailableEmployees(admin, {
    tenantId: params.tenantId,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
    userIds,
    excludeVisitId: params.excludeVisitId,
  });

  const first = available.find((r) => r.available);
  return first?.userId ?? null;
}

export const UNAVAILABILITY_LABEL: Record<UnavailabilityReason, string> = {
  outside_work_window: 'Outside work hours',
  time_off: 'Approved time off',
  visit_overlap: 'Another visit scheduled',
  inactive_member: 'Not an active member',
};
