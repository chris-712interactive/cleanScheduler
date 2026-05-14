'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import { buildTenantInvoiceEmailContent } from '@/lib/email/tenantInvoiceEmailBody';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';

export async function sendTenantInvoiceEmailAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const invoiceId = String(formData.get('invoice_id') ?? '').trim();
  const membership = await requireTenantPortalAccess(tenantSlug, `/billing/invoices/${invoiceId}`);
  const admin = createAdminClient();

  if (!isResendConfigured()) {
    redirect(`/billing/invoices/${invoiceId}?error=${encodeURIComponent('Configure RESEND_API_KEY and RESEND_FROM_EMAIL to send mail.')}`);
  }

  const { data: inv, error: invErr } = await admin
    .from('tenant_invoices')
    .select('id, title, status, amount_cents, amount_paid_cents, due_date, customer_id')
    .eq('id', invoiceId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (invErr || !inv) {
    redirect(`/billing/invoices/${invoiceId}?error=${encodeURIComponent('Invoice not found.')}`);
  }

  const { data: cust, error: cErr } = await admin
    .from('customers')
    .select('customer_identities ( email )')
    .eq('id', inv.customer_id)
    .maybeSingle();

  if (cErr || !cust) {
    redirect(`/billing/invoices/${invoiceId}?error=${encodeURIComponent('Customer not found.')}`);
  }

  const email = (cust.customer_identities as { email: string | null } | null)?.email?.trim();
  if (!email) {
    redirect(`/billing/invoices/${invoiceId}?error=${encodeURIComponent('Customer has no email on file.')}`);
  }

  const { data: tenant } = await admin.from('tenants').select('name').eq('id', membership.tenantId).maybeSingle();
  const tenantName = tenant?.name?.trim() || membership.tenantSlug;
  const balance = Math.max(0, inv.amount_cents - inv.amount_paid_cents);
  const dueLabel = inv.due_date ? new Date(String(inv.due_date)).toLocaleDateString() : null;
  const portalUrl = `${getPublicOrigin('my')}/invoices/${invoiceId}`;

  const body = buildTenantInvoiceEmailContent({
    tenantName,
    invoiceTitle: inv.title,
    totalCents: inv.amount_cents,
    paidCents: inv.amount_paid_cents,
    balanceCents: balance,
    status: inv.status,
    dueLabel,
    portalUrl,
  });

  const sent = await sendTransactionalEmail({ to: email, ...body });
  if (!sent.ok) {
    redirect(`/billing/invoices/${invoiceId}?error=${encodeURIComponent(sent.error)}`);
  }

  redirect(`/billing/invoices/${invoiceId}?email=sent`);
}
