import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { debitCustomerWalletCredit } from '@/lib/promotions/customerWallet';

type Admin = SupabaseClient<Database>;

export async function finalizeInvoicePromotionsOnPayment(
  admin: Admin,
  input: {
    tenantId: string;
    invoiceId: string;
    customerId: string;
  },
): Promise<void> {
  const { data: invoice, error } = await admin
    .from('tenant_invoices')
    .select('applied_promotion_id, wallet_credit_applied_cents, promo_discount_cents')
    .eq('id', input.invoiceId)
    .eq('tenant_id', input.tenantId)
    .maybeSingle();

  if (error || !invoice) return;

  const walletCredit = invoice.wallet_credit_applied_cents ?? 0;
  const promotionId = invoice.applied_promotion_id;

  if (walletCredit <= 0 && !promotionId) return;

  if (walletCredit > 0) {
    const { data: existingTx } = await admin
      .from('tenant_customer_wallet_transactions')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .eq('customer_id', input.customerId)
      .eq('kind', 'credit_apply')
      .ilike('note', `%invoice:${input.invoiceId}%`)
      .limit(1)
      .maybeSingle();

    if (!existingTx) {
      await debitCustomerWalletCredit(admin, {
        tenantId: input.tenantId,
        customerId: input.customerId,
        amountCents: walletCredit,
        note: `Applied to invoice payment (invoice:${input.invoiceId})`,
      });
    }
  }

  if (promotionId) {
    const { data: pending } = await admin
      .from('tenant_promotion_redemptions')
      .select('id')
      .eq('invoice_id', input.invoiceId)
      .eq('promotion_id', promotionId)
      .eq('status', 'pending')
      .maybeSingle();

    if (pending) {
      await admin
        .from('tenant_promotion_redemptions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          amount_applied_cents: invoice.promo_discount_cents ?? 0,
        })
        .eq('id', pending.id);
    } else {
      await admin.from('tenant_promotion_redemptions').insert({
        tenant_id: input.tenantId,
        promotion_id: promotionId,
        customer_id: input.customerId,
        invoice_id: input.invoiceId,
        status: 'completed',
        amount_applied_cents: invoice.promo_discount_cents ?? 0,
        completed_at: new Date().toISOString(),
      });
    }
  }
}
