import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  createDefaultMemberDayWindows,
  effectiveDayWindowsFromMemberDays,
  memberDayWindowsFromDbRows,
  type EffectiveMemberSchedule,
  type MemberDayWindow,
  type MemberScheduleProfile,
} from '@/lib/tenant/memberAvailabilityDays';
import { DEFAULT_TENANT_TIMEZONE } from '@/lib/datetime/formatInTimeZone';
import { type WorkWeekDayKey, WORK_WEEK_DAY_KEYS } from '@/lib/tenant/tenantBusinessSettings';
import { tenantBusinessSnapshotFromRow } from '@/lib/tenant/tenantBusinessSettings';

type Admin = SupabaseClient<Database>;

function isWorkWeekDayKey(value: string): value is WorkWeekDayKey {
  return WORK_WEEK_DAY_KEYS.includes(value as WorkWeekDayKey);
}

function tenantDayWindowsFromBusiness(business: {
  workWeekDays: WorkWeekDayKey[];
  workDayStart: string;
  workDayEnd: string;
}): EffectiveMemberSchedule['dayWindows'] {
  const dayWindows: EffectiveMemberSchedule['dayWindows'] = {};
  for (const weekday of business.workWeekDays) {
    dayWindows[weekday] = {
      startsAt: business.workDayStart,
      endsAt: business.workDayEnd,
    };
  }
  return dayWindows;
}

async function loadTenantBusiness(admin: Admin, tenantId: string) {
  const { data: tenantRow } = await admin
    .from('tenants')
    .select(
      'timezone, work_week_days, work_day_start, work_day_end, name, business_email, business_phone, brand_color, logo_url, address_line1, city, state, postal_code, country',
    )
    .eq('id', tenantId)
    .maybeSingle();

  if (!tenantRow) return null;

  return tenantBusinessSnapshotFromRow({
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
  });
}

export async function loadTenantTimezone(admin: Admin, tenantId: string): Promise<string> {
  const business = await loadTenantBusiness(admin, tenantId);
  return business?.timezone ?? DEFAULT_TENANT_TIMEZONE;
}

async function loadMemberAvailabilityDayRows(
  admin: Admin,
  tenantId: string,
  userId: string,
): Promise<MemberDayWindow[]> {
  const { data } = await admin
    .from('tenant_member_availability_days')
    .select('weekday, starts_at, ends_at')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId);

  const rows = (data ?? []).filter((row) => isWorkWeekDayKey(row.weekday));
  return memberDayWindowsFromDbRows(rows);
}

export async function loadEffectiveMemberSchedule(
  admin: Admin,
  tenantId: string,
  userId: string,
): Promise<EffectiveMemberSchedule | null> {
  const [business, { data: profileRow }] = await Promise.all([
    loadTenantBusiness(admin, tenantId),
    admin
      .from('tenant_member_schedule_profiles')
      .select('use_tenant_default')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .maybeSingle(),
  ]);

  if (!business) return null;

  if (!profileRow || profileRow.use_tenant_default) {
    return {
      userId,
      timezone: business.timezone,
      dayWindows: tenantDayWindowsFromBusiness(business),
    };
  }

  const days = await loadMemberAvailabilityDayRows(admin, tenantId, userId);
  return {
    userId,
    timezone: business.timezone,
    dayWindows: effectiveDayWindowsFromMemberDays(days),
  };
}

export async function loadMemberScheduleProfile(
  admin: Admin,
  tenantId: string,
  userId: string,
): Promise<MemberScheduleProfile> {
  const business = await loadTenantBusiness(admin, tenantId);
  const defaultDays = createDefaultMemberDayWindows({
    enabledWeekdays: business?.workWeekDays,
    startsAt: business?.workDayStart,
    endsAt: business?.workDayEnd,
  });

  const [{ data: profileRow }, customDays] = await Promise.all([
    admin
      .from('tenant_member_schedule_profiles')
      .select('use_tenant_default')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .maybeSingle(),
    loadMemberAvailabilityDayRows(admin, tenantId, userId),
  ]);

  const useTenantDefault = profileRow?.use_tenant_default ?? true;
  const days =
    customDays.some((day) => day.enabled) || !useTenantDefault ? customDays : defaultDays;

  return {
    userId,
    useTenantDefault,
    days,
  };
}

export async function loadEffectiveSchedulesForMembers(
  admin: Admin,
  tenantId: string,
  userIds: string[],
): Promise<Map<string, EffectiveMemberSchedule>> {
  const map = new Map<string, EffectiveMemberSchedule>();
  if (userIds.length === 0) return map;

  await Promise.all(
    userIds.map(async (userId) => {
      const schedule = await loadEffectiveMemberSchedule(admin, tenantId, userId);
      if (schedule) map.set(userId, schedule);
    }),
  );

  return map;
}

export type {
  EffectiveMemberSchedule,
  MemberDayWindow,
  MemberScheduleProfile,
} from '@/lib/tenant/memberAvailabilityDays';
