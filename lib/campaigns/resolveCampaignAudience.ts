import type { SupabaseClient } from '@supabase/supabase-js';
import { inviteTemplateCustomerFirstName } from '@/lib/tenant/customerIdentityName';
import type { Database } from '@/lib/supabase/database.types';
import type { CampaignAudienceMember, CampaignAudiencePreset } from '@/lib/campaigns/types';

type CustomerRow = {
  id: string;
  status: string;
  customer_identities: {
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
    auth_user_id: string | null;
  } | null;
  tenant_customer_profiles: {
    marketing_email_opt_in: boolean;
    preferred_contact_method: 'email' | 'phone' | 'sms' | null;
  } | null;
  tenant_customer_properties: {
    property_kind: string;
    is_primary: boolean;
  }[] | null;
};

function normalizeEmail(email: string | null | undefined): string | null {
  const value = email?.trim().toLowerCase();
  return value || null;
}

async function loadSuppressedEmails(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<Set<string>> {
  const { data } = await admin
    .from('tenant_email_suppressions')
    .select('email_normalized')
    .eq('tenant_id', tenantId);

  return new Set((data ?? []).map((row) => row.email_normalized.toLowerCase()));
}

async function loadOpenBalanceCustomerIds(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<Set<string>> {
  const { data } = await admin
    .from('tenant_invoices')
    .select('customer_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'open');

  return new Set((data ?? []).map((row) => row.customer_id).filter(Boolean) as string[]);
}

function passesBaseMarketable(
  row: CustomerRow,
  suppressed: Set<string>,
): CampaignAudienceMember | null {
  if (row.status !== 'active') return null;
  if (!row.tenant_customer_profiles?.marketing_email_opt_in) return null;

  const email = normalizeEmail(row.customer_identities?.email);
  if (!email || suppressed.has(email)) return null;

  const identity = row.customer_identities;
  const firstName = identity
    ? inviteTemplateCustomerFirstName({
        first_name: identity.first_name,
        full_name: identity.full_name,
      })
    : 'there';

  return {
    customerId: row.id,
    email,
    firstName,
  };
}

function matchesPreset(
  row: CustomerRow,
  preset: CampaignAudiencePreset,
  openBalanceIds: Set<string>,
): boolean {
  switch (preset) {
    case 'all_marketable':
      return true;
    case 'email_preferred': {
      const method = row.tenant_customer_profiles?.preferred_contact_method;
      return method == null || method === 'email';
    }
    case 'residential': {
      const properties = row.tenant_customer_properties ?? [];
      const primary = properties.find((p) => p.is_primary) ?? properties[0];
      return primary?.property_kind === 'residential';
    }
    case 'portal_nudge':
      return !row.customer_identities?.auth_user_id;
    case 'open_balance':
      return openBalanceIds.has(row.id);
    default:
      return false;
  }
}

export async function resolveCampaignAudience(params: {
  admin: SupabaseClient<Database>;
  tenantId: string;
  preset: CampaignAudiencePreset;
}): Promise<CampaignAudienceMember[]> {
  const [suppressed, openBalanceIds, customersRes] = await Promise.all([
    loadSuppressedEmails(params.admin, params.tenantId),
    params.preset === 'open_balance'
      ? loadOpenBalanceCustomerIds(params.admin, params.tenantId)
      : Promise.resolve(new Set<string>()),
    params.admin
      .from('customers')
      .select(
        `
        id,
        status,
        customer_identities (
          email,
          first_name,
          last_name,
          full_name,
          auth_user_id
        ),
        tenant_customer_profiles (
          marketing_email_opt_in,
          preferred_contact_method
        ),
        tenant_customer_properties (
          property_kind,
          is_primary
        )
      `,
      )
      .eq('tenant_id', params.tenantId),
  ]);

  if (customersRes.error) {
    throw new Error(customersRes.error.message);
  }

  const members: CampaignAudienceMember[] = [];
  for (const row of (customersRes.data ?? []) as CustomerRow[]) {
    const base = passesBaseMarketable(row, suppressed);
    if (!base) continue;
    if (!matchesPreset(row, params.preset, openBalanceIds)) continue;
    members.push(base);
  }

  return members;
}

export async function countCampaignAudiencePreview(params: {
  admin: SupabaseClient<Database>;
  tenantId: string;
  preset: CampaignAudiencePreset;
}): Promise<number> {
  const audience = await resolveCampaignAudience(params);
  return audience.length;
}
