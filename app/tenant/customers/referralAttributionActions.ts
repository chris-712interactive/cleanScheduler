'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  assertTenantFeatureEnabled,
  featureGateErrorMessage,
} from '@/lib/billing/tenantFeatureGate';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { attributeRefereeByReferrerCustomer } from '@/lib/referrals/referralAttribution';
import { resolveTenantCustomerIdByEmail } from '@/lib/referrals/loadCustomerReferralAttribution';

export type ReferralAttributionActionState = {
  error?: string;
  success?: boolean;
};

export async function attributeCustomerReferralAction(
  _prev: ReferralAttributionActionState,
  formData: FormData,
): Promise<ReferralAttributionActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const refereeCustomerId = String(formData.get('referee_customer_id') ?? '').trim();
  const referrerEmail = String(formData.get('referrer_email') ?? '').trim();

  if (!slug || !refereeCustomerId || !referrerEmail) {
    return { error: 'Enter the referring customer’s email address.' };
  }

  const membership = await requireTenantPortalAccess(slug, `/customers/${refereeCustomerId}`);
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can attribute referrals.' };
  }

  const admin = createAdminClient();
  try {
    await assertTenantFeatureEnabled(admin, membership.tenantId, 'customerReferralProgram');
  } catch (error) {
    return {
      error: featureGateErrorMessage(error) ?? 'Referrals are not enabled on this workspace.',
    };
  }

  const resolved = await resolveTenantCustomerIdByEmail(admin, membership.tenantId, referrerEmail);
  if (!resolved.ok) {
    return { error: resolved.error };
  }

  const result = await attributeRefereeByReferrerCustomer(admin, {
    tenantId: membership.tenantId,
    refereeCustomerId,
    referrerCustomerId: resolved.customerId,
    referrerDisplayName: resolved.displayName,
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath(`/customers/${refereeCustomerId}`, 'page');
  revalidatePath('/referrals', 'page');

  return { success: true };
}
