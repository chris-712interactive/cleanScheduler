import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import { buildInvoiceReceiptEmailContent } from '@/lib/email/tenantInvoiceEmailBody';
import { customerPortalUrlForTenant } from '@/lib/portal/customerPortalOrigin';

type Admin = SupabaseClient<Database>;

export async function sendInvoiceReceiptEmail(
  admin: Admin,
  params: { tenantId: string; invoiceId: string; paymentAmountCents?: number },
): Promise<void> {
  if (!isResendConfigured()) return;

  const { data: inv } = await admin
    .from('tenant_invoices')
    .select('id, title, amount_cents, amount_paid_cents, customer_id, status')
    .eq('tenant_id', params.tenantId)
    .eq('id', params.invoiceId)
    .maybeSingle();

  if (!inv || inv.status !== 'paid') return;

  const { data: cust } = await admin
    .from('customers')
    .select('customer_identities ( email )')
    .eq('id', inv.customer_id)
    .maybeSingle();

  const email = (cust?.customer_identities as { email: string | null } | null)?.email?.trim();
  if (!email) return;

  const { data: tenant } = await admin
    .from('tenants')
    .select('name, slug')
    .eq('id', params.tenantId)
    .maybeSingle();

  const tenantName = tenant?.name?.trim() || tenant?.slug || 'Your provider';
  const portalUrl = await customerPortalUrlForTenant(
    admin,
    params.tenantId,
    `/invoices/${params.invoiceId}`,
  );

  const body = buildInvoiceReceiptEmailContent({
    tenantName,
    invoiceTitle: inv.title,
    amountPaidCents: params.paymentAmountCents ?? inv.amount_paid_cents,
    totalCents: inv.amount_cents,
    portalUrl,
  });

  await sendTransactionalEmail({ to: email, ...body });
}
