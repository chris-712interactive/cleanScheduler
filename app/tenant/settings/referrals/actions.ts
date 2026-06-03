'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  assertTenantFeatureEnabled,
  featureGateErrorMessage,
  minimumTierLabelForFeature,
} from '@/lib/billing/tenantFeatureGate';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { parseReferralProgramForm } from '@/lib/referrals/referralProgramForm';
import { ensureTenantReferralProgramRow } from '@/lib/referrals/loadTenantReferralProgram';

export interface ReferralProgramActionState {
  error?: string;
  success?: boolean;
}

export async function updateTenantReferralProgramAction(
  _prev: ReferralProgramActionState,
  formData: FormData,
): Promise<ReferralProgramActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  if (!slug) return { error: 'Missing workspace.' };

  const parsed = parseReferralProgramForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const membership = await requireTenantPortalAccess(slug, '/settings/referrals');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can manage referrals.' };
  }

  const admin = createAdminClient();
  try {
    await assertTenantFeatureEnabled(admin, membership.tenantId, 'customerReferralProgram');
  } catch (error) {
    return {
      error:
        featureGateErrorMessage(error) ??
        `Upgrade to ${minimumTierLabelForFeature('customerReferralProgram')} to configure referrals.`,
    };
  }

  await ensureTenantReferralProgramRow(admin, membership.tenantId);

  const promotionIds = [parsed.referrer_promotion_id, parsed.referee_promotion_id].filter(
    (id): id is string => Boolean(id),
  );
  if (promotionIds.length > 0) {
    const { count } = await admin
      .from('tenant_promotions')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', membership.tenantId)
      .in('id', promotionIds);
    if ((count ?? 0) !== promotionIds.length) {
      return { error: 'One or more selected promotions are invalid for this workspace.' };
    }
  }

  const { error } = await admin
    .from('tenant_referral_programs')
    .update({
      is_enabled: parsed.is_enabled,
      reward_side_mode: parsed.reward_side_mode,
      referrer_promotion_id: parsed.referrer_promotion_id,
      referee_promotion_id: parsed.referee_promotion_id,
      click_window_days: parsed.click_window_days,
      share_headline: parsed.share_headline,
      terms_text: parsed.terms_text,
    })
    .eq('tenant_id', membership.tenantId);

  if (error) return { error: error.message };

  revalidatePath('/tenant/settings/referrals', 'page');
  revalidatePath('/customer/referrals', 'page');
  return { success: true };
}
