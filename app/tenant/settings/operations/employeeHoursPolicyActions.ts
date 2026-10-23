'use server';

import { revalidatePath } from 'next/cache';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';

export interface EmployeeHoursPolicyActionState {
  error?: string;
  success?: boolean;
}

export async function updateEmployeeHoursPolicyAction(
  _prev: EmployeeHoursPolicyActionState,
  formData: FormData,
): Promise<EmployeeHoursPolicyActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  if (!slug) return { error: 'Missing workspace.' };

  const membership = await requireTenantPortalAccess(slug, '/settings/operations');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can change employee hour settings.' };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('tenant_operational_settings')
    .update({
      employees_can_edit_own_hours: formData.get('employees_can_edit_own_hours') === 'on',
      employee_hours_require_approval: formData.get('employee_hours_require_approval') === 'on',
    })
    .eq('tenant_id', membership.tenantId);

  if (error) return { error: 'Could not save employee hour settings.' };

  revalidatePath('/tenant/settings/operations', 'page');
  revalidatePath('/tenant/settings/account', 'page');
  revalidatePath('/tenant/schedule/hours-requests', 'page');
  return { success: true };
}
