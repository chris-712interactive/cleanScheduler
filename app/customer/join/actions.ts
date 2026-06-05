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
import { draftFromFormData, type ReferralSignupDraft } from '@/lib/referrals/referralSignupDraft';

export type ReferralJoinActionState = {
  error?: string;
  step?: 'signup';
  mode?: 'new' | 'existing';
  email?: string;
  prefill?: ReferralJoinPrefill;
  draft?: ReferralSignupDraft;
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
  const draft = draftFromFormData(formData);
  const password = draft.password;
  const confirm = draft.confirmPassword;

  if (!rawCode || !tenantId || !email) {
    return { error: 'Your session expired. Start again from your referral link.' };
  }

  if (!password || password.length < 8) {
    return {
      error: 'Password must be at least 8 characters.',
      step: 'signup',
      mode: existingCustomerId ? 'existing' : 'new',
      email,
      draft,
    };
  }
  if (password !== confirm) {
    return {
      error: 'Passwords do not match.',
      step: 'signup',
      mode: existingCustomerId ? 'existing' : 'new',
      email,
      draft,
    };
  }

  const smsOptIn = draft.smsOptIn;
  const phone = draft.phone;
  if (smsOptIn && !phone) {
    return {
      error: 'Enter a phone number to opt in to SMS.',
      step: 'signup',
      mode: existingCustomerId ? 'existing' : 'new',
      email,
      draft,
    };
  }

  const admin = createAdminClient();
  const result = await signupReferralReferee(admin, {
    tenantId,
    referralCode: rawCode,
    email,
    firstName: draft.firstName,
    lastName: draft.lastName,
    phone,
    serviceAddressLine1: draft.serviceAddressLine1,
    serviceAddressLine2: draft.serviceAddressLine2,
    serviceCity: draft.serviceCity,
    serviceState: draft.serviceState,
    servicePostalCode: draft.servicePostalCode,
    password,
    smsOptIn,
    marketingEmailOptIn: draft.marketingEmailOptIn,
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
      draft,
    };
  }

  await clearReferralCookie();
  redirect('/');
}
