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

export async function loadReferralCustomerContact(
  admin: Admin,
  customerId: string,
): Promise<{ email: string | null; displayName: string }> {
  const { data, error } = await admin
    .from('customers')
    .select('customer_identities ( email, first_name, last_name, full_name )')
    .eq('id', customerId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const identity = data?.customer_identities as IdentityEmbed | null;
  return {
    email: identity?.email?.trim() ?? null,
    displayName: identity ? formatCustomerDisplayName(identity) : 'Customer',
  };
}
