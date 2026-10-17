import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantRole } from '@/lib/auth/types';
import type { Database } from '@/lib/supabase/database.types';
import { canBeScheduledAsCrew } from '@/lib/tenant/employeePermissions';

export type VisitScheduleKind = 'service' | 'consultation';

export type MemberScheduleEligibility = {
  role: TenantRole;
  excludeFromJobs: boolean;
  excludeFromConsultations: boolean;
};

export type SchedulingProfileScope = 'full' | 'consultation' | 'hidden';

/** Owners and admins can opt out of jobs, consultations, or both. */
export function officeRoleCanOptOut(role: TenantRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function schedulesVisitKind(
  member: MemberScheduleEligibility,
  kind: VisitScheduleKind,
): boolean {
  if (!canBeScheduledAsCrew(member.role)) return false;
  if (!officeRoleCanOptOut(member.role)) return true;
  if (kind === 'consultation') return !member.excludeFromConsultations;
  return !member.excludeFromJobs;
}

/**
 * Full profile for people who take jobs.
 * Consultation-only keeps travel, language, and experience.
 * Both opt-outs hide availability and the scheduling profile.
 */
export async function ineligibleScheduleMessage(
  admin: SupabaseClient<Database>,
  tenantId: string,
  userIds: string[],
  kind: VisitScheduleKind,
): Promise<string | null> {
  if (userIds.length === 0) return null;
  const { data } = await admin
    .from('tenant_memberships')
    .select('user_id, role, exclude_from_job_schedule, exclude_from_consultation_schedule')
    .eq('tenant_id', tenantId)
    .in('user_id', userIds);
  const rows = new Map((data ?? []).map((row) => [row.user_id, row]));
  const blocked = userIds.some((id) => {
    const row = rows.get(id);
    if (!row) return true;
    return !schedulesVisitKind(
      {
        role: row.role,
        excludeFromJobs: row.exclude_from_job_schedule,
        excludeFromConsultations: row.exclude_from_consultation_schedule,
      },
      kind,
    );
  });
  if (!blocked) return null;
  return kind === 'consultation'
    ? 'One of the people selected is not scheduled for consultations.'
    : 'One of the people selected is not scheduled for jobs.';
}

export function schedulingProfileScope(member: MemberScheduleEligibility): SchedulingProfileScope {
  if (!officeRoleCanOptOut(member.role)) return 'full';
  if (member.excludeFromJobs && member.excludeFromConsultations) return 'hidden';
  if (member.excludeFromJobs) return 'consultation';
  return 'full';
}
