'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { tenantRoleError } from '@/lib/auth/tenantRoleAccess';
import { getAuthContext } from '@/lib/auth/session';
import { recordTenantPaymentEvent } from '@/lib/audit/recordTenantPaymentEvent';
import { afterInvoicePaymentRecorded } from '@/lib/integrations/emitInvoiceWebhook';
import {
  assertPermission,
  permissionDeniedMessage,
  resolveMembershipPermissions,
} from '@/lib/tenant/resolveMembershipPermissions';
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
  const roleErr = tenantRoleError(membership.role, 'employee');
  if (roleErr) {
    redirect(`/billing/invoices/new?error=${encodeURIComponent(roleErr)}`);
  }

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

  const admin = createAdminClient();
  const permissions = await resolveMembershipPermissions(admin, membership);
  try {
    assertPermission(permissions, 'billing.manage');
  } catch (error) {
    redirect(
      `/billing/invoices/${invoiceId || 'unknown'}?error=${encodeURIComponent(permissionDeniedMessage(error) ?? 'Forbidden')}`,
    );
  }

  const amountCents = parseCentsFromDollars(String(formData.get('amount_dollars') ?? ''));
  const method = String(formData.get('method') ?? 'other').trim() as PaymentMethod;
  const notes = String(formData.get('notes') ?? '').trim() || null;
  const checkNumber = String(formData.get('check_number') ?? '').trim() || null;
  const zelleConfirmation = String(formData.get('zelle_confirmation') ?? '').trim() || null;

  if (method === 'card') {
    redirect(
      `/billing/invoices/${invoiceId || 'unknown'}?error=${encodeURIComponent('Use Pay online with card after Stripe Connect is complete.')}`,
    );
  }

  const allowed: PaymentMethod[] = ['cash', 'check', 'zelle', 'ach', 'other'];
  const safeMethod = allowed.includes(method) ? method : 'other';

  if (!invoiceId || amountCents == null || amountCents <= 0) {
    redirect(`/billing/invoices/${invoiceId}?error=invalid`);
  }

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

  const auth = await getAuthContext();

  const { data: paymentRow, error } = await admin
    .from('tenant_invoice_payments')
    .insert({
      tenant_id: membership.tenantId,
      invoice_id: invoiceId,
      amount_cents: payAmount,
      method: safeMethod,
      notes,
      check_number: safeMethod === 'check' ? checkNumber : null,
      zelle_confirmation: safeMethod === 'zelle' ? zelleConfirmation : null,
    })
    .select('id')
    .single();

  if (error || !paymentRow) {
    redirect(`/billing/invoices/${invoiceId}?error=save`);
  }

  await recordTenantPaymentEvent(admin, {
    tenantId: membership.tenantId,
    paymentId: paymentRow.id,
    invoiceId,
    actorUserId: auth?.user.id ?? null,
    action: 'payment.recorded',
    detail: `${safeMethod} payment recorded (${(payAmount / 100).toFixed(2)} USD)`,
  });

  await afterInvoicePaymentRecorded(admin, {
    tenantId: membership.tenantId,
    invoiceId,
  });

  revalidatePath('/billing');
  revalidatePath('/billing/invoices');
  revalidatePath('/billing/transactions');
  revalidatePath('/billing/payment-audits');
  revalidatePath(`/billing/invoices/${invoiceId}`);
  redirect(`/billing/invoices/${invoiceId}`);
}
