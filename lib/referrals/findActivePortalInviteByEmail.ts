import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

export async function findActivePortalInviteTokenByEmail(
  admin: Admin,
  tenantId: string,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from('customer_portal_invites')
    .select('token')
    .eq('tenant_id', tenantId)
    .eq('email_normalized', normalized)
    .is('used_at', null)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.token ?? null;
}
