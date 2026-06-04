'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { buildCompleteInvitePath, customerHasPortalLogin } from '@/lib/tenant/customerPortalInvite';
import { findActivePortalInviteTokenByEmail } from '@/lib/referrals/findActivePortalInviteByEmail';
import { loadReferralJoinLanding } from '@/lib/referrals/loadReferralJoinLanding';
import { resolveTenantCustomerIdByEmail } from '@/lib/referrals/loadCustomerReferralAttribution';

export type ReferralJoinActionState = {
  error?: string;
};

export async function continueReferralJoinAction(
  _prev: ReferralJoinActionState,
  formData: FormData,
): Promise<ReferralJoinActionState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const rawCode = String(formData.get('referral_code') ?? '').trim();

  if (!email || !rawCode) {
    return { error: 'Enter the email address your provider used for your account.' };
  }

  const admin = createAdminClient();
  const landing = await loadReferralJoinLanding(admin, rawCode);
  if (!landing) {
    return { error: 'This referral link is invalid or the program is no longer active.' };
  }

  const resolved = await resolveTenantCustomerIdByEmail(admin, landing.tenantId, email);
  if (resolved.ok && (await customerHasPortalLogin(admin, resolved.customerId))) {
    redirect(`/sign-in?email=${encodeURIComponent(email)}&next=${encodeURIComponent('/')}`);
  }

  const token = await findActivePortalInviteTokenByEmail(admin, landing.tenantId, email);
  if (!token) {
    return {
      error:
        'No active portal invite was found for that email. Ask your provider to send a portal invite, then return to this referral link.',
    };
  }

  redirect(buildCompleteInvitePath(token, '/', landing.referralCode));
}
