import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { emitTenantWebhook } from '@/lib/integrations/emitTenantWebhook';
import { maybeQualifyReferralOnFirstPaidInvoice } from '@/lib/referrals/qualifyReferralOnFirstPaidInvoice';
import { finalizeInvoicePromotionsOnPayment } from '@/lib/promotions/finalizeInvoicePromotionsOnPayment';

type Admin = SupabaseClient<Database>;

export async function maybeEmitInvoicePaidWebhook(
  admin: Admin,
  params: { tenantId: string; invoiceId: string },
): Promise<void> {
  const { data: inv } = await admin
    .from('tenant_invoices')
    .select('id, customer_id, title, status, amount_cents, amount_paid_cents, visit_id')
    .eq('tenant_id', params.tenantId)
    .eq('id', params.invoiceId)
    .maybeSingle();

  if (!inv || inv.status !== 'paid') return;

  await emitTenantWebhook({
    admin,
    tenantId: params.tenantId,
    eventType: 'invoice.paid',
    data: {
      invoice_id: inv.id,
      customer_id: inv.customer_id,
      visit_id: inv.visit_id,
      title: inv.title,
      amount_cents: inv.amount_cents,
      amount_paid_cents: inv.amount_paid_cents,
      status: inv.status,
    },
  });
}

export async function afterInvoicePaymentRecorded(
  admin: Admin,
  params: { tenantId: string; invoiceId: string },
): Promise<void> {
  const { data: inv } = await admin
    .from('tenant_invoices')
    .select('customer_id, status')
    .eq('tenant_id', params.tenantId)
    .eq('id', params.invoiceId)
    .maybeSingle();

  if (inv?.customer_id && inv.status === 'paid') {
    try {
      await finalizeInvoicePromotionsOnPayment(admin, {
        tenantId: params.tenantId,
        invoiceId: params.invoiceId,
        customerId: inv.customer_id,
      });
    } catch (error) {
      console.error(
        '[afterInvoicePaymentRecorded] invoice promotion finalize failed:',
        error,
        params,
      );
    }
  }

  await maybeEmitInvoicePaidWebhook(admin, params);
  try {
    await maybeQualifyReferralOnFirstPaidInvoice(admin, params);
  } catch (error) {
    console.error('[afterInvoicePaymentRecorded] referral qualification failed:', error, params);
  }
}
