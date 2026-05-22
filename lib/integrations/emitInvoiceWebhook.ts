import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { emitTenantWebhook } from '@/lib/integrations/emitTenantWebhook';

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
  await maybeEmitInvoicePaidWebhook(admin, params);
}
