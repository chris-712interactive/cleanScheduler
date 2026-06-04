'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  assertTenantFeatureEnabled,
  featureGateErrorMessage,
} from '@/lib/billing/tenantFeatureGate';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { voidReferralAttribution } from '@/lib/referrals/voidReferralAttribution';

export type VoidReferralAttributionActionState = {
  error?: string;
  success?: boolean;
  clawbackCents?: number;
};

export async function voidReferralAttributionAction(
  _prev: VoidReferralAttributionActionState,
  formData: FormData,
): Promise<VoidReferralAttributionActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const attributionId = String(formData.get('attribution_id') ?? '').trim();

  if (!slug || !attributionId) {
    return { error: 'Invalid request.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/referrals');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can void referrals.' };
  }

  const admin = createAdminClient();
  try {
    await assertTenantFeatureEnabled(admin, membership.tenantId, 'customerReferralProgram');
  } catch (error) {
    return {
      error: featureGateErrorMessage(error) ?? 'Referrals are not enabled on this workspace.',
    };
  }

  const result = await voidReferralAttribution(admin, {
    tenantId: membership.tenantId,
    attributionId,
    reason: 'Staff voided referral attribution',
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath('/referrals', 'page');
  revalidatePath('/customers', 'page');

  return {
    success: true,
    clawbackCents: result.clawbackCents,
  };
}
