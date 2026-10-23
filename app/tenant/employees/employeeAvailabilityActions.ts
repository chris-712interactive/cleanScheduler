'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { MemberScheduleProfile } from '@/lib/schedule/memberScheduleProfile';
import {
  parseMemberAvailabilityDaysFromForm,
  validateMemberDayWindows,
} from '@/lib/tenant/memberAvailabilityDays';
import { canEditMemberAvailability } from '@/lib/tenant/employeePermissions';
import type { TenantRole } from '@/lib/auth/types';
import {
  loadEmployeeHoursPolicy,
  memberHoursSaveMode,
  replacePendingHoursChange,
  saveMemberAvailability,
} from '@/lib/tenant/employeeHoursPolicy';
import { notifyOfficeOfHoursChangeRequest } from '@/lib/email/timeOffNotifications';

export interface MemberAvailabilityActionState {
  error?: string;
  success?: string;
  profilePatch?: MemberScheduleProfile;
}

export async function updateMemberAvailabilityAction(
  _prev: MemberAvailabilityActionState,
  formData: FormData,
): Promise<MemberAvailabilityActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const targetUserId = String(formData.get('target_user_id') ?? '').trim();
  const useTenantDefault = formData.get('use_tenant_default') === 'on';

  if (!slug || !targetUserId) {
    return { error: 'Missing workspace or team member.' };
  }

  const auth = await getAuthContext();
  if (!auth) return { error: 'Not signed in.' };

  const membership = await requireTenantPortalAccess(
    slug,
    auth.user.id === targetUserId ? '/settings/account' : `/employees/${targetUserId}`,
  );

  const admin = createAdminClient();
  const { data: memberRow } = await admin
    .from('tenant_memberships')
    .select('role')
    .eq('tenant_id', membership.tenantId)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (!memberRow) return { error: 'Team member not found.' };

  if (
    !canEditMemberAvailability({
      actor: membership.role as TenantRole,
      actorUserId: auth.user.id,
      targetUserId,
      targetRole: memberRow.role as TenantRole,
    })
  ) {
    return { error: 'You cannot edit this team member.' };
  }

  const days = parseMemberAvailabilityDaysFromForm(formData);
  if (!useTenantDefault) {
    const validationError = validateMemberDayWindows(days);
    if (validationError) return { error: validationError };
  }

  const hoursPolicy = await loadEmployeeHoursPolicy(admin, membership.tenantId);
  const saveMode = memberHoursSaveMode({
    actorRole: membership.role as TenantRole,
    editingSelf: auth.user.id === targetUserId,
    ...hoursPolicy,
  });

  if (saveMode === 'locked') {
    return { error: 'An admin sets your hours.' };
  }

  if (saveMode === 'pending') {
    const pendingError = await replacePendingHoursChange(admin, membership.tenantId, targetUserId, {
      useTenantDefault,
      days,
    });
    if (pendingError) return { error: pendingError };

    const notified = await notifyOfficeOfHoursChangeRequest(admin, {
      tenantId: membership.tenantId,
      requesterUserId: targetUserId,
    });

    revalidatePath(`/employees/${targetUserId}`);
    revalidatePath('/settings/account');
    revalidatePath('/schedule/hours-requests');
    revalidatePath('/dashboard');

    return {
      success:
        notified.emailed > 0
          ? 'Hour change submitted. Your current hours stay in effect until an admin approves them. Owners and admins were emailed.'
          : 'Hour change submitted. Your current hours stay in effect until an admin approves them.',
    };
  }

  const saveError = await saveMemberAvailability(admin, membership.tenantId, targetUserId, {
    useTenantDefault,
    days,
  });
  if (saveError) return { error: saveError };

  revalidatePath(`/employees/${targetUserId}`);
  revalidatePath('/settings/account');
  revalidatePath('/schedule');
  revalidatePath('/schedule/hours-requests');

  return {
    success: 'Work availability saved.',
    profilePatch: {
      userId: targetUserId,
      useTenantDefault,
      days,
    },
  };
}
