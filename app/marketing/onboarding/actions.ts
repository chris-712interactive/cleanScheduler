'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';
import { shouldAutoConfirmEmail } from '@/lib/auth/emailConfirmMode';
import { publicEnv } from '@/lib/env';
import { checkRateLimit, getClientIdentifier } from '@/lib/security/rateLimit';
import { normalizeSlug, validateSlug } from './utils';
import { createPlatformSubscriptionCheckoutUrl } from '@/lib/billing/platformCheckout';
import { parsePlatformPlanTier, resolvePlatformPriceId } from '@/lib/billing/platformPlans';
import { getStripe } from '@/lib/stripe/server';

export interface TenantOnboardingState {
  error?: string;
}
const TRIAL_DAYS = 7;

function resolveRequestOrigin(h: Headers): URL {
  const forwardedProto = h.get('x-forwarded-proto');
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const protocol = forwardedProto ?? 'https';

  if (!host) {
    return new URL(`https://${publicEnv.NEXT_PUBLIC_APP_DOMAIN}`);
  }

  return new URL(`${protocol}://${host}`);
}

function buildTenantOrigin(slug: string, requestOrigin: URL): string {
  const appDomain = publicEnv.NEXT_PUBLIC_APP_DOMAIN;
  return `${requestOrigin.protocol}//${slug}.${appDomain}`;
}

async function ensureSlugAvailable(
  admin: SupabaseClient<Database>,
  slug: string,
): Promise<boolean> {
  const { data, error } = await admin.from('tenants').select('id').eq('slug', slug).maybeSingle();
  return !error && !data;
}

export async function createTenantAndOwner(
  _prevState: TenantOnboardingState,
  formData: FormData,
): Promise<TenantOnboardingState> {
  const requestHeaders = await headers();
  const clientId = getClientIdentifier(requestHeaders);
  const rate = checkRateLimit(`tenant-onboarding:${clientId}`, 10, 10 * 60_000);
  if (!rate.allowed) {
    return { error: `Too many signup attempts. Try again in ${rate.retryAfterSeconds} seconds.` };
  }

  const businessName = String(formData.get('business_name') ?? '').trim();
  const companyEmail = String(formData.get('company_email') ?? '').trim().toLowerCase();
  const companyPhone = String(formData.get('company_phone') ?? '').trim();
  const companyWebsite = String(formData.get('company_website') ?? '').trim();
  const serviceArea = String(formData.get('service_area') ?? '').trim();
  const teamSize = String(formData.get('team_size') ?? '').trim();
  const businessType = String(formData.get('business_type') ?? '').trim();
  const referralSource = String(formData.get('referral_source') ?? '').trim();
  const displayName = String(formData.get('display_name') ?? '').trim();
  const ownerPhone = String(formData.get('owner_phone') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const passwordConfirm = String(formData.get('password_confirm') ?? '');
  const acceptedTerms = String(formData.get('accept_terms') ?? '') === 'on';
  const slugInput = String(formData.get('workspace_slug') ?? '');
  const slug = normalizeSlug(slugInput);
  const platformPlan = parsePlatformPlanTier(String(formData.get('platform_plan') ?? ''));

  if (!businessName || !displayName || !email || !password || !slug) {
    return { error: 'Business name, workspace slug, owner name, email, and password are required.' };
  }
  if (!platformPlan) {
    return { error: 'Choose a subscription plan (Starter, Business, or Pro).' };
  }

  const stripe = getStripe();
  if (stripe && !resolvePlatformPriceId(platformPlan)) {
    return {
      error:
        'Online checkout is not configured for the selected plan. Choose another tier or set STRIPE_PLATFORM_PRICE_* for Starter / Business / Pro (or legacy STRIPE_PLATFORM_PRICE_ID).',
    };
  }
  const slugError = validateSlug(slug);
  if (slugError) {
    return { error: slugError };
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }
  if (password !== passwordConfirm) {
    return { error: 'Passwords do not match. Re-enter both fields and try again.' };
  }
  if (!acceptedTerms) {
    return { error: 'Please accept terms to continue.' };
  }

  const admin = createAdminClient();
  const slugAvailable = await ensureSlugAvailable(admin, slug);
  if (!slugAvailable) {
    return { error: 'That workspace slug is unavailable. Try another.' };
  }

  const autoConfirmEmail = shouldAutoConfirmEmail();
  const createdUser = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: autoConfirmEmail,
    app_metadata: {
      app_role: 'admin',
      tenant_role: 'owner',
    },
    user_metadata: {
      display_name: displayName,
      owner_phone: ownerPhone || null,
      company_name: businessName,
    },
  });

  if (createdUser.error || !createdUser.data.user) {
    return { error: createdUser.error?.message ?? 'Could not create account.' };
  }

  const userId = createdUser.data.user.id;

  const tenantInsert = await admin
    .from('tenants')
    .insert({
      slug,
      name: businessName,
    })
    .select('id, slug')
    .single();

  if (tenantInsert.error || !tenantInsert.data) {
    await admin.auth.admin.deleteUser(userId);
    return { error: tenantInsert.error?.message ?? 'Could not create workspace.' };
  }

  const tenantId = tenantInsert.data.id;

  const membershipInsert = await admin.from('tenant_memberships').insert({
    tenant_id: tenantId,
    user_id: userId,
    role: 'owner',
    is_active: true,
  });

  if (membershipInsert.error) {
    await admin.from('tenants').delete().eq('id', tenantId);
    await admin.auth.admin.deleteUser(userId);
    return { error: membershipInsert.error.message };
  }

  const trialStart = new Date();
  const trialEnd = new Date(trialStart);
  trialEnd.setUTCDate(trialEnd.getUTCDate() + TRIAL_DAYS);

  const billingInsert = await admin.from('tenant_billing_accounts').insert({
    tenant_id: tenantId,
    status: 'trialing',
    trial_started_at: trialStart.toISOString(),
    trial_ends_at: trialEnd.toISOString(),
    platform_plan: platformPlan,
  });

  if (billingInsert.error) {
    await admin.from('tenant_memberships').delete().eq('tenant_id', tenantId).eq('user_id', userId);
    await admin.from('tenants').delete().eq('id', tenantId);
    await admin.auth.admin.deleteUser(userId);
    return { error: billingInsert.error.message };
  }

  const onboardingProfileInsert = await admin.from('tenant_onboarding_profiles').insert({
    tenant_id: tenantId,
    company_email: companyEmail || null,
    company_phone: companyPhone || null,
    company_website: companyWebsite || null,
    service_area: serviceArea || null,
    team_size: teamSize || null,
    business_type: businessType || null,
    referral_source: referralSource || null,
    owner_name: displayName,
    owner_email: email,
    owner_phone: ownerPhone || null,
  });

  if (onboardingProfileInsert.error) {
    await admin.from('tenant_memberships').delete().eq('tenant_id', tenantId).eq('user_id', userId);
    await admin.from('tenant_billing_accounts').delete().eq('tenant_id', tenantId);
    await admin.from('tenants').delete().eq('id', tenantId);
    await admin.auth.admin.deleteUser(userId);
    return { error: onboardingProfileInsert.error.message };
  }

  const profileUpsert = await admin.from('user_profiles').upsert(
    {
      user_id: userId,
      app_role: 'admin',
      display_name: displayName,
    },
    { onConflict: 'user_id' },
  );

  if (profileUpsert.error) {
    await admin.from('tenant_memberships').delete().eq('tenant_id', tenantId).eq('user_id', userId);
    await admin.from('tenant_billing_accounts').delete().eq('tenant_id', tenantId);
    await admin.from('tenant_onboarding_profiles').delete().eq('tenant_id', tenantId);
    await admin.from('tenants').delete().eq('id', tenantId);
    await admin.auth.admin.deleteUser(userId);
    return { error: profileUpsert.error.message };
  }

  await admin.auth.admin.updateUserById(userId, {
    app_metadata: {
      app_role: 'admin',
      tenant_role: 'owner',
      current_tenant_id: tenantId,
    },
  });

  const sessionClient = await createClient();
  const signInResult = await sessionClient.auth.signInWithPassword({ email, password });
  if (signInResult.error) {
    if (!autoConfirmEmail) {
      return {
        error:
          'Account and workspace created. Confirm your email (Supabase Auth setting) before first sign-in.',
      };
    }
    return { error: signInResult.error.message };
  }

  const requestOrigin = resolveRequestOrigin(requestHeaders);
  const tenantOrigin = buildTenantOrigin(slug, requestOrigin);
  const marketingOrigin = requestOrigin;

  const checkoutUrl = await createPlatformSubscriptionCheckoutUrl({
    tenantId,
    tenantSlug: slug,
    customerEmail: email,
    platformPlan,
    successUrl: `${tenantOrigin.replace(/\/$/, '')}/`,
    cancelUrl: `${marketingOrigin.origin}/start-trial`,
  });

  if (checkoutUrl) {
    redirect(checkoutUrl);
  }

  redirect(`${tenantOrigin}/`);
}
