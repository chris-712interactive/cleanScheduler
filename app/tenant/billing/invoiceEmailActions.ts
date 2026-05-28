'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { sendTenantInvoiceEmailForInvoice } from '@/lib/billing/sendTenantInvoiceEmail';

export async function sendTenantInvoiceEmailAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const invoiceId = String(formData.get('invoice_id') ?? '').trim();
  const membership = await requireTenantPortalAccess(tenantSlug, `/billing/invoices/${invoiceId}`);
  const admin = createAdminClient();

  const sent = await sendTenantInvoiceEmailForInvoice(admin, {
    tenantId: membership.tenantId,
    tenantSlug: membership.tenantSlug,
    invoiceId,
  });

  if (!sent.ok) {
    redirect(`/billing/invoices/${invoiceId}?error=${encodeURIComponent(sent.error)}`);
  }

  redirect(`/billing/invoices/${invoiceId}?email=sent`);
}
