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
import { canEditTeamMember } from '@/lib/tenant/employeePermissions';
import type { TenantRole } from '@/lib/auth/types';

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

  const membership = await requireTenantPortalAccess(slug, `/employees/${targetUserId}`);
  const auth = await getAuthContext();
  if (!auth) return { error: 'Not signed in.' };

  const admin = createAdminClient();
  const { data: memberRow } = await admin
    .from('tenant_memberships')
    .select('role')
    .eq('tenant_id', membership.tenantId)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (!memberRow) return { error: 'Team member not found.' };

  if (
    !canEditTeamMember({
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

  const { error: profileError } = await admin.from('tenant_member_schedule_profiles').upsert(
    {
      tenant_id: membership.tenantId,
      user_id: targetUserId,
      use_tenant_default: useTenantDefault,
    },
    { onConflict: 'tenant_id,user_id' },
  );

  if (profileError) return { error: profileError.message };

  await admin
    .from('tenant_member_availability_days')
    .delete()
    .eq('tenant_id', membership.tenantId)
    .eq('user_id', targetUserId);

  if (!useTenantDefault) {
    const enabledDays = days.filter((day) => day.enabled);
    if (enabledDays.length > 0) {
      const { error: daysError } = await admin.from('tenant_member_availability_days').insert(
        enabledDays.map((day) => ({
          tenant_id: membership.tenantId,
          user_id: targetUserId,
          weekday: day.weekday,
          starts_at: day.startsAt,
          ends_at: day.endsAt,
        })),
      );
      if (daysError) return { error: daysError.message };
    }
  }

  revalidatePath(`/employees/${targetUserId}`);
  revalidatePath('/schedule');

  return {
    success: 'Work availability saved.',
    profilePatch: {
      userId: targetUserId,
      useTenantDefault,
      days,
    },
  };
}
