'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { canEditMemberAvailability } from '@/lib/tenant/employeePermissions';
import { officeRoleCanOptOut } from '@/lib/schedule/scheduleEligibility';
import type { TenantRole } from '@/lib/auth/types';

export interface ScheduleEligibilityActionState {
  error?: string;
  success?: boolean;
}

export async function updateScheduleEligibilityAction(
  _prev: ScheduleEligibilityActionState,
  formData: FormData,
): Promise<ScheduleEligibilityActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const targetUserId = String(formData.get('target_user_id') ?? '').trim();
  if (!slug || !targetUserId) return { error: 'Missing team member.' };

  const auth = await getAuthContext();
  if (!auth) return { error: 'Not signed in.' };

  const membership = await requireTenantPortalAccess(
    slug,
    auth.user.id === targetUserId ? '/settings/account' : `/employees/${targetUserId}`,
  );
  const admin = createAdminClient();
  const { data: target } = await admin
    .from('tenant_memberships')
    .select('role')
    .eq('tenant_id', membership.tenantId)
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (!target) return { error: 'Team member not found.' };
  const targetRole = target.role as TenantRole;
  if (!officeRoleCanOptOut(targetRole)) {
    return { error: 'Field employees are always available for jobs and consultations.' };
  }
  if (
    !canEditMemberAvailability({
      actor: membership.role,
      actorUserId: auth.user.id,
      targetUserId,
      targetRole,
    })
  ) {
    return { error: 'You cannot change what this person is scheduled for.' };
  }

  const { error } = await admin
    .from('tenant_memberships')
    .update({
      exclude_from_job_schedule: formData.get('exclude_from_jobs') === 'on',
      exclude_from_consultation_schedule: formData.get('exclude_from_consultations') === 'on',
    })
    .eq('tenant_id', membership.tenantId)
    .eq('user_id', targetUserId);
  if (error) return { error: 'Could not save scheduling role.' };

  revalidatePath(`/tenant/employees/${targetUserId}`, 'page');
  revalidatePath('/tenant/settings/account', 'page');
  revalidatePath('/tenant/schedule', 'page');
  return { success: true };
}
