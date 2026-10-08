'use server';

import { revalidatePath } from 'next/cache';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { parseScheduleOptimizerPolicyFromForm } from '@/lib/schedule/optimizer/policy';
import { createAdminClient } from '@/lib/supabase/server';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';

export interface SchedulingPolicyActionState {
  error?: string;
  success?: boolean;
}

export async function updateScheduleOptimizerPolicyAction(
  _prev: SchedulingPolicyActionState,
  formData: FormData,
): Promise<SchedulingPolicyActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  if (!slug) return { error: 'Missing workspace.' };

  const membership = await requireTenantPortalAccess(slug, '/settings/scheduling');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can change scheduling weights.' };
  }

  const policy = parseScheduleOptimizerPolicyFromForm(formData);
  const admin = createAdminClient();
  const { error } = await admin
    .from('tenant_operational_settings')
    .update({ schedule_optimizer_policy: policy })
    .eq('tenant_id', membership.tenantId);

  if (error) return { error: 'Could not save scheduling weights.' };

  revalidatePath('/tenant/settings/scheduling', 'page');
  revalidatePath('/tenant/settings', 'page');
  return { success: true };
}
