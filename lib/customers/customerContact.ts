import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

export async function customerContactForVisit(
  admin: Admin,
  customerId: string,
): Promise<{ email: string | null; phone: string | null; prefersEmailOnly: boolean }> {
  const { data } = await admin
    .from('customers')
    .select(
      `
      customer_identities ( email, phone ),
      tenant_customer_profiles ( preferred_contact_method )
    `,
    )
    .eq('id', customerId)
    .maybeSingle();

  const identityRaw = data?.customer_identities as
    | { email: string | null; phone: string | null }
    | { email: string | null; phone: string | null }[]
    | null;
  const identity = Array.isArray(identityRaw) ? identityRaw[0] : identityRaw;

  const profileRaw = data?.tenant_customer_profiles as
    | { preferred_contact_method: string | null }
    | { preferred_contact_method: string | null }[]
    | null;
  const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;

  return {
    email: identity?.email?.trim() || null,
    phone: identity?.phone?.trim() || null,
    prefersEmailOnly: profile?.preferred_contact_method === 'email',
  };
}
