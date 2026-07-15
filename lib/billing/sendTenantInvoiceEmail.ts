import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import { buildTenantInvoiceEmailContent } from '@/lib/email/tenantInvoiceEmailBody';
import { customerPortalUrlForTenant } from '@/lib/portal/customerPortalOrigin';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { createOrReuseInvoicePayToken, guestInvoicePayUrl } from '@/lib/billing/invoicePayToken';
import { requireConnectForOnlinePayments } from '@/lib/billing/requireConnect';

type AdminClient = SupabaseClient<Database>;

export async function sendTenantInvoiceEmailForInvoice(
  admin: AdminClient,
  params: { tenantId: string; tenantSlug: string; invoiceId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isResendConfigured()) {
    return {
      ok: false,
      error: 'Configure RESEND_API_KEY and RESEND_FROM_EMAIL to send mail.',
    };
  }

  const { data: inv, error: invErr } = await admin
    .from('tenant_invoices')
    .select('id, title, status, amount_cents, amount_paid_cents, due_date, customer_id')
    .eq('id', params.invoiceId)
    .eq('tenant_id', params.tenantId)
    .maybeSingle();

  if (invErr || !inv) {
    return { ok: false, error: 'Invoice not found.' };
  }

  const { data: cust, error: cErr } = await admin
    .from('customers')
    .select('customer_identities ( email )')
    .eq('id', inv.customer_id)
    .maybeSingle();

  if (cErr || !cust) {
    return { ok: false, error: 'Customer not found.' };
  }

  const email = (cust.customer_identities as { email: string | null } | null)?.email?.trim();
  if (!email) {
    return { ok: false, error: 'Customer has no email on file.' };
  }

  const { data: tenant } = await admin
    .from('tenants')
    .select('name')
    .eq('id', params.tenantId)
    .maybeSingle();
  const tenantName = tenant?.name?.trim() || params.tenantSlug;
  const balance = Math.max(0, inv.amount_cents - inv.amount_paid_cents);
  const dueLabel = inv.due_date ? new Date(String(inv.due_date)).toLocaleDateString() : null;
  const portalUrl = await customerPortalUrlForTenant(
    admin,
    params.tenantId,
    `/invoices/${params.invoiceId}`,
  );

  const plan = await resolveTenantEntitlementPlan(admin, params.tenantId);
  const hasPortal = isFeatureEnabled(plan, 'customerPortal');
  let payUrl: string | null = null;
  if (!hasPortal && balance > 0 && inv.status === 'open') {
    const connect = await requireConnectForOnlinePayments(admin, params.tenantId);
    if (connect.ok) {
      const token = await createOrReuseInvoicePayToken(admin, {
        tenantId: params.tenantId,
        invoiceId: params.invoiceId,
      });
      if (token) payUrl = guestInvoicePayUrl(token);
    }
  }

  const body = buildTenantInvoiceEmailContent({
    tenantName,
    invoiceTitle: inv.title,
    totalCents: inv.amount_cents,
    paidCents: inv.amount_paid_cents,
    balanceCents: balance,
    status: inv.status,
    dueLabel,
    portalUrl,
    payUrl,
    ctaLabel: payUrl ? 'Pay this invoice' : undefined,
  });

  const sent = await sendTransactionalEmail({ to: email, ...body });
  if (!sent.ok) {
    return { ok: false, error: sent.error };
  }

  return { ok: true };
}
