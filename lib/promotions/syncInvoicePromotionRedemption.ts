import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

export async function syncInvoicePromotionRedemption(
  admin: Admin,
  input: {
    tenantId: string;
    invoiceId: string;
    customerId: string;
    promotionId: string | null;
    discountAppliedCents: number;
  },
): Promise<void> {
  const { data: existing } = await admin
    .from('tenant_promotion_redemptions')
    .select('id, promotion_id, status')
    .eq('invoice_id', input.invoiceId)
    .eq('status', 'pending')
    .maybeSingle();

  if (!input.promotionId) {
    if (existing) {
      await admin
        .from('tenant_promotion_redemptions')
        .update({ status: 'voided', voided_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
    return;
  }

  if (existing && existing.promotion_id === input.promotionId) {
    await admin
      .from('tenant_promotion_redemptions')
      .update({ amount_applied_cents: input.discountAppliedCents })
      .eq('id', existing.id);
    return;
  }

  if (existing) {
    await admin
      .from('tenant_promotion_redemptions')
      .update({ status: 'voided', voided_at: new Date().toISOString() })
      .eq('id', existing.id);
  }

  const { error } = await admin.from('tenant_promotion_redemptions').insert({
    tenant_id: input.tenantId,
    promotion_id: input.promotionId,
    customer_id: input.customerId,
    invoice_id: input.invoiceId,
    status: 'pending',
    amount_applied_cents: input.discountAppliedCents,
  });

  if (error) throw new Error(error.message);
}
