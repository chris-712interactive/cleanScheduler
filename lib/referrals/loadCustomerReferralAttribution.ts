import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';

type Admin = SupabaseClient<Database>;

type IdentityEmbed = {
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
};

export type CustomerReferralAttributionView = {
  id: string;
  status: Database['public']['Enums']['referral_attribution_status'];
  attributionSource: Database['public']['Enums']['referral_attribution_source'];
  attributedAt: string;
  expiresAt: string;
  qualifiedAt: string | null;
  referrerCustomerId: string;
  referrerName: string;
  referralCode: string | null;
};

export type CustomerReferralReferrerStats = {
  pendingCount: number;
  qualifiedCount: number;
};

export async function loadCustomerReferralAttributionView(
  admin: Admin,
  tenantId: string,
  customerId: string,
): Promise<{
  asReferee: CustomerReferralAttributionView | null;
  asReferrer: CustomerReferralReferrerStats;
}> {
  const { data: asRefereeRow } = await admin
    .from('referral_attributions')
    .select(
      `
      id,
      status,
      attribution_source,
      attributed_at,
      expires_at,
      qualified_at,
      referrer_customer_id,
      referral_code_id
    `,
    )
    .eq('tenant_id', tenantId)
    .eq('referee_customer_id', customerId)
    .maybeSingle();

  let asReferee: CustomerReferralAttributionView | null = null;
  if (asRefereeRow) {
    const { data: referrerIdentity } = await admin
      .from('customers')
      .select('customer_identities ( email, first_name, last_name, full_name )')
      .eq('id', asRefereeRow.referrer_customer_id)
      .maybeSingle();

    const { data: codeRow } = await admin
      .from('customer_referral_codes')
      .select('code')
      .eq('id', asRefereeRow.referral_code_id)
      .maybeSingle();

    const identity = referrerIdentity?.customer_identities as IdentityEmbed | null;

    asReferee = {
      id: asRefereeRow.id,
      status: asRefereeRow.status,
      attributionSource: asRefereeRow.attribution_source,
      attributedAt: asRefereeRow.attributed_at,
      expiresAt: asRefereeRow.expires_at,
      qualifiedAt: asRefereeRow.qualified_at,
      referrerCustomerId: asRefereeRow.referrer_customer_id,
      referrerName: identity ? formatCustomerDisplayName(identity) : 'Customer',
      referralCode: codeRow?.code ?? null,
    };
  }

  const { data: referrerRows } = await admin
    .from('referral_attributions')
    .select('status')
    .eq('tenant_id', tenantId)
    .eq('referrer_customer_id', customerId);

  const asReferrer: CustomerReferralReferrerStats = {
    pendingCount: 0,
    qualifiedCount: 0,
  };

  for (const row of referrerRows ?? []) {
    if (row.status === 'pending') asReferrer.pendingCount += 1;
    if (row.status === 'qualified') asReferrer.qualifiedCount += 1;
  }

  return { asReferee, asReferrer };
}

export async function resolveTenantCustomerIdByEmail(
  admin: Admin,
  tenantId: string,
  rawEmail: string,
): Promise<{ ok: true; customerId: string; displayName: string } | { ok: false; error: string }> {
  const email = rawEmail.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { ok: false, error: 'Enter a valid referrer email address.' };
  }

  const { data: match, error } = await admin
    .from('customers')
    .select('id, customer_identities!inner ( email, first_name, last_name, full_name )')
    .eq('tenant_id', tenantId)
    .ilike('customer_identities.email', email)
    .limit(1)
    .maybeSingle();
  if (error) {
    return { ok: false, error: error.message };
  }

  if (!match) {
    return { ok: false, error: 'No customer found with that email in this workspace.' };
  }

  const identity = match.customer_identities as IdentityEmbed;
  return {
    ok: true,
    customerId: match.id,
    displayName: formatCustomerDisplayName(identity),
  };
}
