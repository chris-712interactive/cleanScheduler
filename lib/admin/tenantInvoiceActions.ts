'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { Database } from '@/lib/supabase/database.types';

type InvoiceStatus = Database['public']['Enums']['tenant_invoice_status'];
type PaymentMethod = Database['public']['Enums']['tenant_payment_method'];

function parseCentsFromDollars(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export async function createTenantInvoiceAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/invoices/new');

  const customerId = String(formData.get('customer_id') ?? '').trim();
  const title = String(formData.get('title') ?? 'Invoice').trim() || 'Invoice';
  const amountCents = parseCentsFromDollars(String(formData.get('amount_dollars') ?? ''));
  const dueRaw = String(formData.get('due_date') ?? '').trim();
  const notes = String(formData.get('notes') ?? '').trim() || null;

  if (!customerId || amountCents == null || amountCents <= 0) {
    redirect(`/billing/invoices/new?error=invalid`);
  }

  const admin = createAdminClient();
  const { data: cust, error: cErr } = await admin
    .from('customers')
    .select('id')
    .eq('tenant_id', membership.tenantId)
    .eq('id', customerId)
    .maybeSingle();

  if (cErr || !cust) {
    redirect(`/billing/invoices/new?error=customer`);
  }

  const dueDate = dueRaw ? new Date(`${dueRaw}T12:00:00Z`).toISOString() : null;

  const { error } = await admin.from('tenant_invoices').insert({
    tenant_id: membership.tenantId,
    customer_id: customerId,
    title,
    status: 'open' as InvoiceStatus,
    amount_cents: amountCents,
    amount_paid_cents: 0,
    due_date: dueDate,
    notes,
  });

  if (error) {
    redirect(`/billing/invoices/new?error=save`);
  }

  revalidatePath('/tenant/billing');
  revalidatePath('/tenant/billing/invoices');
  redirect('/billing/invoices');
}

export async function recordInvoicePaymentAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/invoices');

  const invoiceId = String(formData.get('invoice_id') ?? '').trim();
  const amountCents = parseCentsFromDollars(String(formData.get('amount_dollars') ?? ''));
  const method = String(formData.get('method') ?? 'other').trim() as PaymentMethod;
  const notes = String(formData.get('notes') ?? '').trim() || null;

  const allowed: PaymentMethod[] = ['cash', 'check', 'zelle', 'card', 'ach', 'other'];
  const safeMethod = allowed.includes(method) ? method : 'other';

  if (!invoiceId || amountCents == null || amountCents <= 0) {
    redirect(`/billing/invoices/${invoiceId}?error=invalid`);
  }

  const admin = createAdminClient();
  const { data: inv, error: invErr } = await admin
    .from('tenant_invoices')
    .select('id, tenant_id, status, amount_cents, amount_paid_cents')
    .eq('id', invoiceId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (invErr || !inv || inv.status === 'void') {
    redirect(`/billing/invoices/${invoiceId}?error=invoice`);
  }

  const remaining = inv.amount_cents - inv.amount_paid_cents;
  if (remaining <= 0) {
    redirect(`/billing/invoices/${invoiceId}?error=paid`);
  }

  const payAmount = Math.min(amountCents, remaining);

  const { error } = await admin.from('tenant_invoice_payments').insert({
    tenant_id: membership.tenantId,
    invoice_id: invoiceId,
    amount_cents: payAmount,
    method: safeMethod,
    notes,
  });

  if (error) {
    redirect(`/billing/invoices/${invoiceId}?error=save`);
  }

  revalidatePath('/tenant/billing');
  revalidatePath('/tenant/billing/invoices');
  revalidatePath(`/tenant/billing/invoices/${invoiceId}`);
  redirect(`/billing/invoices/${invoiceId}`);
}
