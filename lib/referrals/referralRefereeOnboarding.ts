import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { assertMeteredLimit, isLimitExceededError } from '@/lib/billing/checkLimit';
import { attributeRefereeFromReferralCode } from '@/lib/referrals/referralAttribution';
import { findActivePortalInviteTokenByEmail } from '@/lib/referrals/findActivePortalInviteByEmail';
import { loadReferralJoinLanding } from '@/lib/referrals/loadReferralJoinLanding';
import { resolveTenantCustomerIdByEmail } from '@/lib/referrals/loadCustomerReferralAttribution';
import {
  syncedFullNameFromParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';
import { customerHasPortalLogin } from '@/lib/tenant/customerPortalInvite';
import { createClient } from '@/lib/supabase/server';
import { shouldAutoConfirmEmail } from '@/lib/auth/emailConfirmMode';

type Admin = SupabaseClient<Database>;

export type ReferralJoinPrefill = {
  customerId: string | null;
  identityId: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  serviceAddressLine1: string;
  serviceAddressLine2: string;
  serviceCity: string;
  serviceState: string;
  servicePostalCode: string;
};

export type ReferralJoinRoute =
  | { kind: 'sign_in' }
  | { kind: 'complete_invite'; token: string }
  | { kind: 'signup'; mode: 'new' | 'existing'; prefill: ReferralJoinPrefill };

type PropertyEmbed = {
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
};

export async function resolveReferralJoinRoute(
  admin: Admin,
  input: { tenantId: string; email: string },
): Promise<ReferralJoinRoute | { kind: 'error'; error: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes('@')) {
    return { kind: 'error', error: 'Enter a valid email address.' };
  }

  const tier = await resolveTenantPlanTier(admin, input.tenantId);
  if (!isFeatureEnabled(tier, 'customerPortal')) {
    return { kind: 'error', error: 'The customer portal is not available for this provider.' };
  }

  const resolved = await resolveTenantCustomerIdByEmail(admin, input.tenantId, email);
  if (resolved.ok && (await customerHasPortalLogin(admin, resolved.customerId))) {
    return { kind: 'sign_in' };
  }

  const inviteToken = await findActivePortalInviteTokenByEmail(admin, input.tenantId, email);
  if (inviteToken) {
    return { kind: 'complete_invite', token: inviteToken };
  }

  const prefill = resolved.ok
    ? await loadReferralJoinCustomerPrefill(admin, input.tenantId, resolved.customerId, email)
    : emptyReferralJoinPrefill(email);

  return {
    kind: 'signup',
    mode: resolved.ok ? 'existing' : 'new',
    prefill,
  };
}

function emptyReferralJoinPrefill(email: string): ReferralJoinPrefill {
  return {
    customerId: null,
    identityId: null,
    email,
    firstName: '',
    lastName: '',
    phone: '',
    serviceAddressLine1: '',
    serviceAddressLine2: '',
    serviceCity: '',
    serviceState: '',
    servicePostalCode: '',
  };
}

export async function loadReferralJoinCustomerPrefill(
  admin: Admin,
  tenantId: string,
  customerId: string,
  email: string,
): Promise<ReferralJoinPrefill> {
  const { data: customer } = await admin
    .from('customers')
    .select(
      `
      id,
      customer_identity_id,
      customer_identities ( first_name, last_name, phone, email ),
      tenant_customer_profiles ( company_name ),
      tenant_customer_properties (
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        is_primary
      )
    `,
    )
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const identity = customer?.customer_identities as {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
  } | null;

  type PropertyRow = PropertyEmbed & { is_primary?: boolean | null };
  const propertiesRaw = customer?.tenant_customer_properties as PropertyRow[] | PropertyRow | null;
  const properties = Array.isArray(propertiesRaw)
    ? propertiesRaw
    : propertiesRaw
      ? [propertiesRaw]
      : [];
  const primary = properties.find((row) => row.is_primary) ?? properties[0];

  return {
    customerId,
    identityId: (customer?.customer_identity_id as string | null) ?? null,
    email: email.trim().toLowerCase(),
    firstName: identity?.first_name?.trim() ?? '',
    lastName: identity?.last_name?.trim() ?? '',
    phone: identity?.phone?.trim() ?? '',
    serviceAddressLine1: primary?.address_line1?.trim() ?? '',
    serviceAddressLine2: primary?.address_line2?.trim() ?? '',
    serviceCity: primary?.city?.trim() ?? '',
    serviceState: primary?.state?.trim() ?? '',
    servicePostalCode: primary?.postal_code?.trim() ?? '',
  };
}

export type ReferralRefereeSignupInput = {
  tenantId: string;
  referralCode: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  serviceAddressLine1: string;
  serviceAddressLine2: string;
  serviceCity: string;
  serviceState: string;
  servicePostalCode: string;
  password: string;
  smsOptIn: boolean;
  marketingEmailOptIn: boolean;
  existingCustomerId: string | null;
  existingIdentityId: string | null;
};

export async function signupReferralReferee(
  admin: Admin,
  input: ReferralRefereeSignupInput,
): Promise<{ ok: true } | { ok: false; error: string; duplicateAccount?: boolean }> {
  if (!shouldAutoConfirmEmail()) {
    return {
      ok: false,
      error:
        'Automatic email confirmation is off for this environment. Contact your provider to finish setup.',
    };
  }

  const landing = await loadReferralJoinLanding(admin, input.referralCode, input.tenantId);
  if (!landing) {
    return {
      ok: false,
      error: 'This referral link is invalid or the program is no longer active.',
    };
  }

  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  if (!firstName) {
    return { ok: false, error: 'First name is required.' };
  }

  let customerId = input.existingCustomerId;
  let identityId = input.existingIdentityId;

  if (customerId && identityId) {
    const updated = await updateExistingReferralRefereeProfile(admin, {
      tenantId: input.tenantId,
      customerId,
      identityId,
      firstName,
      lastName: input.lastName.trim(),
      phone: input.phone.trim(),
      serviceAddressLine1: input.serviceAddressLine1.trim(),
      serviceAddressLine2: input.serviceAddressLine2.trim(),
      serviceCity: input.serviceCity.trim(),
      serviceState: input.serviceState.trim(),
      servicePostalCode: input.servicePostalCode.trim(),
      smsOptIn: input.smsOptIn,
      marketingEmailOptIn: input.marketingEmailOptIn,
    });
    if (!updated.ok) return updated;
  } else {
    try {
      await assertMeteredLimit(admin, input.tenantId, 'maxActiveCustomers', 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Plan limit reached.';
      if (isLimitExceededError(error)) {
        return {
          ok: false,
          error:
            'This provider cannot accept new customers online right now. Contact them directly to get started.',
        };
      }
      return { ok: false, error: message };
    }

    const created = await createReferralRefereeCustomer(admin, {
      tenantId: input.tenantId,
      email,
      firstName,
      lastName: input.lastName.trim(),
      phone: input.phone.trim(),
      serviceAddressLine1: input.serviceAddressLine1.trim(),
      serviceAddressLine2: input.serviceAddressLine2.trim(),
      serviceCity: input.serviceCity.trim(),
      serviceState: input.serviceState.trim(),
      servicePostalCode: input.servicePostalCode.trim(),
      marketingEmailOptIn: input.marketingEmailOptIn,
      smsOptIn: input.smsOptIn,
    });
    if (!created.ok) return created;
    customerId = created.customerId;
    identityId = created.identityId;
  }

  const linked = await linkReferralRefereePortalAccount(admin, {
    tenantId: input.tenantId,
    customerId: customerId!,
    identityId: identityId!,
    email,
    firstName,
    lastName: input.lastName.trim(),
    password: input.password,
    referralCode: input.referralCode,
  });

  return linked;
}

async function updateExistingReferralRefereeProfile(
  admin: Admin,
  input: {
    tenantId: string;
    customerId: string;
    identityId: string;
    firstName: string;
    lastName: string;
    phone: string;
    serviceAddressLine1: string;
    serviceAddressLine2: string;
    serviceCity: string;
    serviceState: string;
    servicePostalCode: string;
    smsOptIn: boolean;
    marketingEmailOptIn: boolean;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: identity } = await admin
    .from('customer_identities')
    .select('auth_user_id')
    .eq('id', input.identityId)
    .maybeSingle();

  if (identity?.auth_user_id) {
    return { ok: false, error: 'This customer already has a portal login. Sign in instead.' };
  }

  const fullName = syncedFullNameFromParts(input.firstName, input.lastName);
  const { error: identityError } = await admin
    .from('customer_identities')
    .update({
      first_name: input.firstName,
      last_name: input.lastName || null,
      full_name: fullName,
      phone: input.phone || null,
    })
    .eq('id', input.identityId);

  if (identityError) return { ok: false, error: identityError.message };

  await admin.from('tenant_customer_profiles').upsert(
    {
      tenant_id: input.tenantId,
      customer_id: input.customerId,
      marketing_email_opt_in: input.marketingEmailOptIn,
      sms_transactional_opt_in: input.smsOptIn,
      sms_transactional_opt_in_at: input.smsOptIn ? new Date().toISOString() : null,
    },
    { onConflict: 'customer_id' },
  );

  const hasAddress = Boolean(input.serviceAddressLine1);
  if (hasAddress) {
    const { data: existingProperty } = await admin
      .from('tenant_customer_properties')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .eq('customer_id', input.customerId)
      .eq('is_primary', true)
      .maybeSingle();

    const propertyPayload = {
      address_line1: input.serviceAddressLine1,
      address_line2: input.serviceAddressLine2 || null,
      city: input.serviceCity || null,
      state: input.serviceState || null,
      postal_code: input.servicePostalCode || null,
    };

    if (existingProperty?.id) {
      await admin
        .from('tenant_customer_properties')
        .update(propertyPayload)
        .eq('id', existingProperty.id);
    } else {
      await admin.from('tenant_customer_properties').insert({
        tenant_id: input.tenantId,
        customer_id: input.customerId,
        label: 'Primary service location',
        property_kind: 'residential',
        is_primary: true,
        ...propertyPayload,
      });
    }
  }

  return { ok: true };
}

async function createReferralRefereeCustomer(
  admin: Admin,
  input: {
    tenantId: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    serviceAddressLine1: string;
    serviceAddressLine2: string;
    serviceCity: string;
    serviceState: string;
    servicePostalCode: string;
    marketingEmailOptIn: boolean;
    smsOptIn: boolean;
  },
): Promise<{ ok: true; customerId: string; identityId: string } | { ok: false; error: string }> {
  const fullName = syncedFullNameFromParts(input.firstName, input.lastName);

  const identityInsert = await admin
    .from('customer_identities')
    .insert({
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName || null,
      full_name: fullName,
      phone: input.phone || null,
    })
    .select('id')
    .single();

  if (identityInsert.error || !identityInsert.data) {
    return { ok: false, error: identityInsert.error?.message ?? 'Could not create customer.' };
  }

  const identityId = identityInsert.data.id as string;

  const customerInsert = await admin
    .from('customers')
    .insert({
      tenant_id: input.tenantId,
      customer_identity_id: identityId,
      status: 'active',
    })
    .select('id')
    .single();

  if (customerInsert.error || !customerInsert.data) {
    await admin.from('customer_identities').delete().eq('id', identityId);
    return { ok: false, error: customerInsert.error?.message ?? 'Could not create customer.' };
  }

  const customerId = customerInsert.data.id as string;

  const linkInsert = await admin.from('customer_tenant_links').insert({
    customer_identity_id: identityId,
    tenant_id: input.tenantId,
    customer_id: customerId,
    is_primary: true,
  });

  if (linkInsert.error) {
    await admin.from('customers').delete().eq('id', customerId);
    await admin.from('customer_identities').delete().eq('id', identityId);
    return { ok: false, error: linkInsert.error.message };
  }

  const profileInsert = await admin.from('tenant_customer_profiles').insert({
    tenant_id: input.tenantId,
    customer_id: customerId,
    preferred_contact_method: 'email',
    preferred_payment_method: 'card',
    marketing_email_opt_in: input.marketingEmailOptIn,
    sms_transactional_opt_in: input.smsOptIn,
    sms_transactional_opt_in_at: input.smsOptIn ? new Date().toISOString() : null,
  });

  if (profileInsert.error) {
    await rollbackReferralCustomer(admin, customerId, identityId);
    return { ok: false, error: profileInsert.error.message };
  }

  const propertyInsert = await admin.from('tenant_customer_properties').insert({
    tenant_id: input.tenantId,
    customer_id: customerId,
    label: 'Primary service location',
    property_kind: 'residential',
    address_line1: input.serviceAddressLine1 || null,
    address_line2: input.serviceAddressLine2 || null,
    city: input.serviceCity || null,
    state: input.serviceState || null,
    postal_code: input.servicePostalCode || null,
    is_primary: true,
  });

  if (propertyInsert.error) {
    await rollbackReferralCustomer(admin, customerId, identityId);
    return { ok: false, error: propertyInsert.error.message };
  }

  return { ok: true, customerId, identityId };
}

async function rollbackReferralCustomer(
  admin: Admin,
  customerId: string,
  identityId: string,
): Promise<void> {
  await admin.from('tenant_customer_profiles').delete().eq('customer_id', customerId);
  await admin.from('customer_tenant_links').delete().eq('customer_id', customerId);
  await admin.from('customers').delete().eq('id', customerId);
  await admin.from('customer_identities').delete().eq('id', identityId);
}

async function linkReferralRefereePortalAccount(
  admin: Admin,
  input: {
    tenantId: string;
    customerId: string;
    identityId: string;
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    referralCode: string;
  },
): Promise<{ ok: true } | { ok: false; error: string; duplicateAccount?: boolean }> {
  const identityLabel = formatCustomerDisplayName({
    first_name: input.firstName,
    last_name: input.lastName || null,
    full_name: syncedFullNameFromParts(input.firstName, input.lastName),
  });
  const displayName =
    identityLabel !== 'Unnamed' ? identityLabel : input.email.split('@')[0] || 'Customer';

  const created = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    app_metadata: { app_role: 'customer' },
    user_metadata: { display_name: displayName },
  });

  if (created.error || !created.data.user) {
    const msg = created.error?.message ?? 'Could not create account.';
    if (/already|registered|exists/i.test(msg)) {
      return {
        ok: false,
        duplicateAccount: true,
        error: 'An account already exists for this email. Sign in to continue.',
      };
    }
    return { ok: false, error: msg };
  }

  const userId = created.data.user.id;

  const { error: linkErr } = await admin
    .from('customer_identities')
    .update({ auth_user_id: userId })
    .eq('id', input.identityId)
    .is('auth_user_id', null);

  if (linkErr) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: linkErr.message };
  }

  const { error: profErr } = await admin.from('user_profiles').upsert(
    {
      user_id: userId,
      app_role: 'customer',
      display_name: displayName,
    },
    { onConflict: 'user_id' },
  );

  if (profErr) {
    await admin
      .from('customer_identities')
      .update({ auth_user_id: null })
      .eq('id', input.identityId);
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, error: profErr.message };
  }

  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { app_role: 'customer' },
  });

  const session = await createClient();
  const { error: signErr } = await session.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (signErr) {
    await admin
      .from('customer_identities')
      .update({ auth_user_id: null })
      .eq('id', input.identityId);
    await admin.from('user_profiles').delete().eq('user_id', userId);
    await admin.auth.admin.deleteUser(userId);
    return {
      ok: false,
      error: `Account was created but sign-in failed (${signErr.message}). Try signing in manually.`,
    };
  }

  const attribution = await attributeRefereeFromReferralCode(admin, {
    tenantId: input.tenantId,
    refereeCustomerId: input.customerId,
    rawReferralCode: input.referralCode,
  });

  if (!attribution.ok && !attribution.skipped) {
    console.warn('[referral-join] attribution failed:', attribution.error);
  }

  return { ok: true };
}
