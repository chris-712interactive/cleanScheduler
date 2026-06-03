import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { PromotionListEntry } from '@/lib/promotions/promotionTypes';

type Admin = SupabaseClient<Database>;

export async function loadTenantPromotions(
  admin: Admin,
  tenantId: string,
): Promise<PromotionListEntry[]> {
  const { data: promotions, error } = await admin
    .from('tenant_promotions')
    .select(
      `
      id,
      name,
      code,
      promotion_type,
      promotion_value,
      usage_type,
      max_redemptions,
      max_redemptions_per_customer,
      min_purchase_cents,
      valid_from,
      valid_until,
      is_active,
      is_referral_only,
      created_at
    `,
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  if (!promotions?.length) return [];

  const ids = promotions.map((p) => p.id);
  const { data: redemptionRows, error: redemptionError } = await admin
    .from('tenant_promotion_redemptions')
    .select('promotion_id')
    .in('promotion_id', ids)
    .in('status', ['pending', 'completed']);

  if (redemptionError) throw new Error(redemptionError.message);

  const counts = new Map<string, number>();
  for (const row of redemptionRows ?? []) {
    counts.set(row.promotion_id, (counts.get(row.promotion_id) ?? 0) + 1);
  }

  return promotions.map((p) => ({
    ...p,
    redemption_count: counts.get(p.id) ?? 0,
  }));
}
