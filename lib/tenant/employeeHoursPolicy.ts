import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantRole } from '@/lib/auth/types';
import type { Database } from '@/lib/supabase/database.types';
import {
  memberDayWindowsFromDbRows,
  summarizeMemberDayWindows,
  type MemberDayWindow,
} from '@/lib/tenant/memberAvailabilityDays';
import { isFieldEmployeeRole } from '@/lib/tenant/fieldEmployeeAccess';

type Admin = SupabaseClient<Database>;

export type EmployeeHoursPolicy = {
  employeesCanEditOwnHours: boolean;
  employeeHoursRequireApproval: boolean;
};

export type MemberHoursSaveMode = 'immediate' | 'pending' | 'locked';

export type HoursChangeNotice = {
  id: string;
  status: 'pending' | 'denied';
  summary: string;
};

export const DEFAULT_EMPLOYEE_HOURS_POLICY: EmployeeHoursPolicy = {
  employeesCanEditOwnHours: true,
  employeeHoursRequireApproval: false,
};

export function canReviewEmployeeHours(role: TenantRole): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * Field employees follow the office switches. Owners and admins save hours immediately,
 * including on their own account and on an employee record.
 */
export function memberHoursSaveMode(input: {
  actorRole: TenantRole;
  editingSelf: boolean;
  employeesCanEditOwnHours: boolean;
  employeeHoursRequireApproval: boolean;
}): MemberHoursSaveMode {
  if (!isFieldEmployeeRole(input.actorRole) || !input.editingSelf) return 'immediate';
  if (!input.employeesCanEditOwnHours) return 'locked';
  if (input.employeeHoursRequireApproval) return 'pending';
  return 'immediate';
}

export function summarizeHoursChange(input: {
  useTenantDefault: boolean;
  days: MemberDayWindow[];
}): string {
  if (input.useTenantDefault) return 'Company hours';
  return summarizeMemberDayWindows(input.days);
}

export async function loadEmployeeHoursPolicy(
  admin: Admin,
  tenantId: string,
): Promise<EmployeeHoursPolicy> {
  const { data } = await admin
    .from('tenant_operational_settings')
    .select('employees_can_edit_own_hours, employee_hours_require_approval')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return {
    employeesCanEditOwnHours:
      data?.employees_can_edit_own_hours ?? DEFAULT_EMPLOYEE_HOURS_POLICY.employeesCanEditOwnHours,
    employeeHoursRequireApproval:
      data?.employee_hours_require_approval ??
      DEFAULT_EMPLOYEE_HOURS_POLICY.employeeHoursRequireApproval,
  };
}

export async function saveMemberAvailability(
  admin: Admin,
  tenantId: string,
  userId: string,
  input: { useTenantDefault: boolean; days: MemberDayWindow[] },
  options?: { clearPending?: boolean },
): Promise<string | null> {
  const { error: profileError } = await admin.from('tenant_member_schedule_profiles').upsert(
    {
      tenant_id: tenantId,
      user_id: userId,
      use_tenant_default: input.useTenantDefault,
    },
    { onConflict: 'tenant_id,user_id' },
  );
  if (profileError) return profileError.message;

  const { error: deleteError } = await admin
    .from('tenant_member_availability_days')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('user_id', userId);
  if (deleteError) return deleteError.message;

  if (!input.useTenantDefault) {
    const enabledDays = input.days.filter((day) => day.enabled);
    if (enabledDays.length > 0) {
      const { error: daysError } = await admin.from('tenant_member_availability_days').insert(
        enabledDays.map((day) => ({
          tenant_id: tenantId,
          user_id: userId,
          weekday: day.weekday,
          starts_at: day.startsAt,
          ends_at: day.endsAt,
        })),
      );
      if (daysError) return daysError.message;
    }
  }

  if (options?.clearPending !== false) {
    const cleared = await clearPendingHoursChange(admin, tenantId, userId);
    if (cleared) return cleared;
  }
  return null;
}

export async function replacePendingHoursChange(
  admin: Admin,
  tenantId: string,
  userId: string,
  input: { useTenantDefault: boolean; days: MemberDayWindow[] },
): Promise<string | null> {
  const cleared = await clearPendingHoursChange(admin, tenantId, userId);
  if (cleared) return cleared;

  const { data: request, error } = await admin
    .from('tenant_member_availability_change_requests')
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      use_tenant_default: input.useTenantDefault,
      status: 'pending',
    })
    .select('id')
    .single();
  if (error || !request) return error?.message ?? 'Could not submit the hour change.';

  if (!input.useTenantDefault) {
    const enabledDays = input.days.filter((day) => day.enabled);
    if (enabledDays.length > 0) {
      const { error: daysError } = await admin
        .from('tenant_member_availability_change_request_days')
        .insert(
          enabledDays.map((day) => ({
            request_id: request.id,
            weekday: day.weekday,
            starts_at: day.startsAt,
            ends_at: day.endsAt,
          })),
        );
      if (daysError) return daysError.message;
    }
  }

  return null;
}

export async function clearPendingHoursChange(
  admin: Admin,
  tenantId: string,
  userId: string,
): Promise<string | null> {
  const { error } = await admin
    .from('tenant_member_availability_change_requests')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('status', 'pending');
  return error?.message ?? null;
}

export async function countPendingHoursChanges(admin: Admin, tenantId: string): Promise<number> {
  const { count, error } = await admin
    .from('tenant_member_availability_change_requests')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'pending');
  if (error) return 0;
  return count ?? 0;
}

export async function loadHoursChangeNotice(
  admin: Admin,
  tenantId: string,
  userId: string,
): Promise<HoursChangeNotice | null> {
  const { data: request } = await admin
    .from('tenant_member_availability_change_requests')
    .select('id, status, use_tenant_default')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .in('status', ['pending', 'denied'])
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!request || (request.status !== 'pending' && request.status !== 'denied')) return null;

  const { data: dayRows } = await admin
    .from('tenant_member_availability_change_request_days')
    .select('weekday, starts_at, ends_at')
    .eq('request_id', request.id);

  return {
    id: request.id,
    status: request.status,
    summary: summarizeHoursChange({
      useTenantDefault: request.use_tenant_default,
      days: memberDayWindowsFromDbRows(dayRows ?? []),
    }),
  };
}
