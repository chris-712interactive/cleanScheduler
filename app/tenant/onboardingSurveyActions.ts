'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import type { TenantRole } from '@/lib/auth/types';

export interface OnboardingSurveyState {
  error?: string;
  success?: boolean;
}

export async function saveOwnerOnboardingSurvey(
  _prevState: OnboardingSurveyState,
  formData: FormData,
): Promise<OnboardingSurveyState> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const serviceArea = String(formData.get('service_area') ?? '').trim();
  const teamSize = String(formData.get('team_size') ?? '').trim();
  const referralSource = String(formData.get('referral_source') ?? '').trim();

  if (!tenantSlug) {
    return { error: 'Workspace is missing. Refresh and try again.' };
  }

  const membership = await requireTenantPortalAccess(tenantSlug, '/');
  if (!canManageTeamInvitesAndRoles(membership.role as TenantRole)) {
    return { error: 'Only workspace owners and admins can update this information.' };
  }

  if (!serviceArea || !teamSize) {
    return { error: 'Service area and team size are required.' };
  }

  const db = createTenantPortalDbClient();
  const { data: existing } = await db
    .from('tenant_onboarding_profiles')
    .select('id')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (!existing) {
    return { error: 'Onboarding profile not found for this workspace.' };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('tenant_onboarding_profiles')
    .update({
      service_area: serviceArea,
      team_size: teamSize,
      referral_source: referralSource || null,
    })
    .eq('tenant_id', membership.tenantId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/tenant');
  return { success: true };
}
