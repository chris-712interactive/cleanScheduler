'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { buildCompleteInvitePath } from '@/lib/tenant/customerPortalInvite';
import { loadReferralJoinLanding } from '@/lib/referrals/loadReferralJoinLanding';
import {
  resolveReferralJoinRoute,
  signupReferralReferee,
  type ReferralJoinPrefill,
} from '@/lib/referrals/referralRefereeOnboarding';
import { clearReferralCookie } from '@/lib/referrals/referralCookie';

export type ReferralJoinActionState = {
  error?: string;
  step?: 'signup';
  mode?: 'new' | 'existing';
  email?: string;
  prefill?: ReferralJoinPrefill;
  duplicateAccount?: boolean;
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
    return { error: 'Enter your email address to continue.' };
  }

  const admin = createAdminClient();
  const landing = await loadReferralJoinLanding(admin, rawCode);
  if (!landing) {
    return { error: 'This referral link is invalid or the program is no longer active.' };
  }

  const route = await resolveReferralJoinRoute(admin, {
    tenantId: landing.tenantId,
    email,
  });

  if (route.kind === 'error') {
    return { error: route.error };
  }

  if (route.kind === 'sign_in') {
    redirect(`/sign-in?email=${encodeURIComponent(email)}&next=${encodeURIComponent('/')}`);
  }

  if (route.kind === 'complete_invite') {
    redirect(buildCompleteInvitePath(route.token, '/', landing.referralCode));
  }

  return {
    step: 'signup',
    mode: route.mode,
    email,
    prefill: route.prefill,
  };
}

export async function signupReferralRefereeAction(
  _prev: ReferralJoinActionState,
  formData: FormData,
): Promise<ReferralJoinActionState> {
  const rawCode = String(formData.get('referral_code') ?? '').trim();
  const tenantId = String(formData.get('tenant_id') ?? '').trim();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const existingCustomerId = String(formData.get('existing_customer_id') ?? '').trim() || null;
  const existingIdentityId = String(formData.get('existing_identity_id') ?? '').trim() || null;
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm_password') ?? '');

  if (!rawCode || !tenantId || !email) {
    return { error: 'Your session expired. Start again from your referral link.' };
  }

  if (!password || password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }
  if (password !== confirm) {
    return { error: 'Passwords do not match.' };
  }

  const smsOptIn = formData.get('sms_opt_in') === 'on';
  const phone = String(formData.get('phone') ?? '').trim();
  if (smsOptIn && !phone) {
    return { error: 'Enter a phone number to opt in to SMS.' };
  }

  const admin = createAdminClient();
  const result = await signupReferralReferee(admin, {
    tenantId,
    referralCode: rawCode,
    email,
    firstName: String(formData.get('first_name') ?? '').trim(),
    lastName: String(formData.get('last_name') ?? '').trim(),
    phone,
    serviceAddressLine1: String(formData.get('service_address_line1') ?? '').trim(),
    serviceAddressLine2: String(formData.get('service_address_line2') ?? '').trim(),
    serviceCity: String(formData.get('service_city') ?? '').trim(),
    serviceState: String(formData.get('service_state') ?? '').trim(),
    servicePostalCode: String(formData.get('service_postal_code') ?? '').trim(),
    password,
    smsOptIn,
    marketingEmailOptIn: formData.get('marketing_email_opt_in') === 'on',
    existingCustomerId,
    existingIdentityId,
  });

  if (!result.ok) {
    return {
      error: result.error,
      duplicateAccount: result.duplicateAccount,
      step: 'signup',
      mode: existingCustomerId ? 'existing' : 'new',
      email,
    };
  }

  await clearReferralCookie();
  redirect('/');
}
