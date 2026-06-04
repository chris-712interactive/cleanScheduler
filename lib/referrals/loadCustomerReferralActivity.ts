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

export type CustomerReferralActivityRow = {
  id: string;
  status: Database['public']['Enums']['referral_attribution_status'];
  refereeLabel: string;
  attributedAt: string;
  qualifiedAt: string | null;
};

const ACTIVITY_LIMIT = 10;

export async function loadCustomerReferralActivity(
  admin: Admin,
  tenantId: string,
  referrerCustomerId: string,
): Promise<CustomerReferralActivityRow[]> {
  const { data: rows, error } = await admin
    .from('referral_attributions')
    .select('id, status, attributed_at, qualified_at, referee_customer_id')
    .eq('tenant_id', tenantId)
    .eq('referrer_customer_id', referrerCustomerId)
    .order('attributed_at', { ascending: false })
    .limit(ACTIVITY_LIMIT);

  if (error) throw new Error(error.message);
  if (!rows?.length) return [];

  const refereeIds = rows.map((row) => row.referee_customer_id);
  const { data: customers, error: customerError } = await admin
    .from('customers')
    .select('id, customer_identities ( email, first_name, last_name, full_name )')
    .eq('tenant_id', tenantId)
    .in('id', refereeIds);

  if (customerError) throw new Error(customerError.message);

  const nameMap = new Map<string, string>();
  for (const customer of customers ?? []) {
    const identity = customer.customer_identities as IdentityEmbed | null;
    nameMap.set(customer.id, identity ? formatCustomerDisplayName(identity) : 'Customer');
  }

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    refereeLabel: nameMap.get(row.referee_customer_id) ?? 'Customer',
    attributedAt: row.attributed_at,
    qualifiedAt: row.qualified_at,
  }));
}
