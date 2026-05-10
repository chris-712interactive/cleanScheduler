'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { publicEnv, serverEnv } from '@/lib/env';
import { checkRateLimit, getClientIdentifier } from '@/lib/security/rateLimit';
import { normalizeSlug, validateSlug } from './utils';

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
  // Database types are still scaffold placeholders; use runtime checks here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  slug: string,
): Promise<boolean> {
  const { data, error } = await admin.from('tenants').select('id').eq('slug', slug).maybeSingle();
  return !error && !data;
}

function shouldAutoConfirmEmail(): boolean {
  const mode = serverEnv.ONBOARDING_EMAIL_CONFIRM_MODE;
  if (mode === 'required') return false;
  if (mode === 'disabled') return true;
  return publicEnv.NEXT_PUBLIC_APP_ENV !== 'prod';
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
  const displayName = String(formData.get('display_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const slugInput = String(formData.get('workspace_slug') ?? '');
  const slug = normalizeSlug(slugInput);

  if (!businessName || !displayName || !email || !password || !slug) {
    return { error: 'Business name, workspace slug, owner name, email, and password are required.' };
  }
  const slugError = validateSlug(slug);
  if (slugError) {
    return { error: slugError };
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }

  // Database types are currently ungenerated (`Tables: Record<string, never>`),
  // so we intentionally use `any` for bootstrap onboarding writes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
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
  });

  if (billingInsert.error) {
    await admin.from('tenant_memberships').delete().eq('tenant_id', tenantId).eq('user_id', userId);
    await admin.from('tenants').delete().eq('id', tenantId);
    await admin.auth.admin.deleteUser(userId);
    return { error: billingInsert.error.message };
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
  redirect(`${tenantOrigin}/`);
}
