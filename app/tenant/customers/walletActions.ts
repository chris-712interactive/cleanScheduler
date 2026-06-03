'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  assertTenantFeatureEnabled,
  featureGateErrorMessage,
} from '@/lib/billing/tenantFeatureGate';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { redeemAccountCreditPromotionForCustomer } from '@/lib/promotions/quotePromotions';

export type CustomerWalletActionState = {
  error?: string;
  success?: boolean;
  grantedCents?: number;
  balanceAfterCents?: number;
};

export async function redeemCustomerCreditCodeAction(
  _prev: CustomerWalletActionState,
  formData: FormData,
): Promise<CustomerWalletActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const rawCode = String(formData.get('credit_code') ?? '').trim();

  if (!slug || !customerId || !rawCode) {
    return { error: 'Enter a credit code to redeem.' };
  }

  const membership = await requireTenantPortalAccess(slug, `/customers/${customerId}`);
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can redeem credit codes.' };
  }

  const admin = createAdminClient();
  try {
    await assertTenantFeatureEnabled(admin, membership.tenantId, 'customerPromotions');
  } catch (error) {
    return {
      error: featureGateErrorMessage(error) ?? 'Promotions are not enabled on this workspace.',
    };
  }

  const result = await redeemAccountCreditPromotionForCustomer(admin, {
    tenantId: membership.tenantId,
    customerId,
    rawCode,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath(`/tenant/customers/${customerId}`, 'page');
  revalidatePath('/tenant/quotes', 'page');

  return {
    success: true,
    grantedCents: result.grantedCents,
    balanceAfterCents: result.balanceAfterCents,
  };
}
