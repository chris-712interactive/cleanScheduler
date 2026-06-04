import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { loadTenantReferralProgram } from '@/lib/referrals/loadTenantReferralProgram';

type Admin = SupabaseClient<Database>;

export async function tenantReferralsNavEnabled(admin: Admin, tenantId: string): Promise<boolean> {
  const tier = await resolveTenantPlanTier(admin, tenantId);
  if (!isFeatureEnabled(tier, 'customerReferralProgram')) return false;
  const program = await loadTenantReferralProgram(admin, tenantId);
  return program?.is_enabled === true;
}

export async function countPendingReferralAttributions(
  admin: Admin,
  tenantId: string,
): Promise<number> {
  const { count, error } = await admin
    .from('referral_attributions')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'pending');

  if (error) throw new Error(error.message);
  return count ?? 0;
}
