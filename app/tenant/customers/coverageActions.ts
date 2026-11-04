'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { sendTenantInvoiceEmailForInvoice } from '@/lib/billing/sendTenantInvoiceEmail';
import { inferInvoicePropertyId } from '@/lib/billing/invoiceProperty';

function customerPath(customerId: string, error?: string) {
  return error
    ? `/customers/${customerId}?error=${encodeURIComponent(error)}`
    : `/customers/${customerId}`;
}

export async function endCoverageOnDateAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const grantId = String(formData.get('grant_id') ?? '').trim();
  const date = String(formData.get('coverage_ends_on') ?? '').trim();
  const membership = await requireTenantPortalAccess(tenantSlug, `/customers/${customerId}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    redirect(customerPath(customerId, 'Choose the date coverage stops.'));
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from('subscription_coverage_grants')
    .update({ coverage_ends_on: date, updated_at: new Date().toISOString() })
    .eq('id', grantId)
    .eq('tenant_id', membership.tenantId)
    .eq('status', 'open');
  if (error) redirect(customerPath(customerId, error.message));
  revalidatePath(`/customers/${customerId}`);
  redirect(customerPath(customerId));
}

export async function dismissMakeupAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const makeupId = String(formData.get('makeup_id') ?? '').trim();
  const membership = await requireTenantPortalAccess(tenantSlug, `/customers/${customerId}`);
  const admin = createAdminClient();
  const { error } = await admin
    .from('subscription_coverage_makeups')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', makeupId)
    .eq('tenant_id', membership.tenantId)
    .is('consumed_visit_id', null);
  if (error) redirect(customerPath(customerId, error.message));
  revalidatePath(`/customers/${customerId}`);
  redirect(customerPath(customerId));
}

export async function invoiceWaitingVisitAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const visitId = String(formData.get('visit_id') ?? '').trim();
  const membership = await requireTenantPortalAccess(tenantSlug, `/customers/${customerId}`);
  const admin = createAdminClient();
  const { data: visit } = await admin
    .from('tenant_scheduled_visits')
    .select(
      'id, title, customer_id, expected_amount_cents, quote_id, coverage_status, completion_invoice_id',
    )
    .eq('id', visitId)
    .eq('tenant_id', membership.tenantId)
    .eq('customer_id', customerId)
    .maybeSingle();
  if (!visit || visit.coverage_status !== 'waiting' || visit.completion_invoice_id) {
    redirect(customerPath(customerId, 'That clean is not waiting on the subscription.'));
  }
  let amount = visit.expected_amount_cents;
  if ((amount == null || amount <= 0) && visit.quote_id) {
    const { data: quote } = await admin
      .from('tenant_quotes')
      .select('amount_cents')
      .eq('id', visit.quote_id)
      .maybeSingle();
    amount = quote?.amount_cents ?? null;
  }
  if (amount == null || amount <= 0) {
    redirect(customerPath(customerId, 'Add a price before invoicing this clean.'));
  }
  const propertyId = await inferInvoicePropertyId(admin, {
    tenantId: membership.tenantId,
    customerId,
    visitId,
  });
  const { data: invoice, error } = await admin
    .from('tenant_invoices')
    .insert({
      tenant_id: membership.tenantId,
      customer_id: customerId,
      visit_id: visitId,
      property_id: propertyId,
      title: visit.title.trim() || 'Service visit',
      status: 'open',
      amount_cents: amount,
      amount_paid_cents: 0,
    })
    .select('id')
    .single();
  if (error || !invoice) redirect(customerPath(customerId, error?.message ?? 'Could not invoice.'));
  await admin
    .from('tenant_scheduled_visits')
    .update({
      completion_invoice_id: invoice.id,
      coverage_status: null,
      coverage_grant_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', visitId)
    .eq('tenant_id', membership.tenantId);
  await sendTenantInvoiceEmailForInvoice(admin, {
    tenantId: membership.tenantId,
    tenantSlug: membership.tenantSlug,
    invoiceId: invoice.id,
  }).catch(() => undefined);
  revalidatePath(`/customers/${customerId}`);
  revalidatePath(`/schedule/${visitId}`);
  redirect(customerPath(customerId));
}

export async function markVisitIncludedAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const visitId = String(formData.get('visit_id') ?? '').trim();
  const grantId = String(formData.get('grant_id') ?? '').trim();
  const membership = await requireTenantPortalAccess(tenantSlug, `/customers/${customerId}`);
  const admin = createAdminClient();
  const { data: grant } = await admin
    .from('subscription_coverage_grants')
    .select('id, included_cleans, status')
    .eq('id', grantId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();
  if (!grant || grant.status !== 'open') {
    redirect(customerPath(customerId, 'That coverage period is not open.'));
  }
  const { count } = await admin
    .from('tenant_scheduled_visits')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', membership.tenantId)
    .eq('coverage_grant_id', grant.id)
    .eq('coverage_status', 'covered');
  if ((count ?? 0) >= grant.included_cleans) {
    redirect(customerPath(customerId, 'This period has no open clean left.'));
  }
  const { data: visit } = await admin
    .from('tenant_scheduled_visits')
    .select('completion_invoice_id')
    .eq('id', visitId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();
  if (!visit?.completion_invoice_id) {
    redirect(customerPath(customerId, 'This visit has no invoice to include.'));
  }
  const { data: invoice } = await admin
    .from('tenant_invoices')
    .select('id, status, amount_paid_cents')
    .eq('id', visit.completion_invoice_id)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();
  if (!invoice) redirect(customerPath(customerId, 'Invoice not found.'));
  if (invoice.status === 'paid' && invoice.amount_paid_cents > 0) {
    redirect(customerPath(customerId, 'Refund this invoice first, then mark the clean included.'));
  }
  await admin
    .from('tenant_invoices')
    .update({ status: 'void', updated_at: new Date().toISOString() })
    .eq('id', invoice.id)
    .eq('tenant_id', membership.tenantId);
  await admin
    .from('tenant_scheduled_visits')
    .update({
      completion_invoice_id: null,
      coverage_status: 'covered',
      coverage_grant_id: grant.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', visitId)
    .eq('tenant_id', membership.tenantId);
  revalidatePath(`/customers/${customerId}`);
  redirect(customerPath(customerId));
}

export async function reopenCompletedVisitAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const visitId = String(formData.get('visit_id') ?? '').trim();
  const membership = await requireTenantPortalAccess(tenantSlug, `/schedule/${visitId}`);
  const admin = createAdminClient();
  const { data: visit } = await admin
    .from('tenant_scheduled_visits')
    .select('id, status, coverage_makeup_id, coverage_addon_invoice_id')
    .eq('id', visitId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();
  if (!visit || visit.status !== 'completed') {
    redirect(
      `/schedule/${visitId}?error=${encodeURIComponent('Only a completed visit can be reopened.')}`,
    );
  }
  if (visit.coverage_makeup_id) {
    await admin
      .from('subscription_coverage_makeups')
      .update({ consumed_visit_id: null })
      .eq('id', visit.coverage_makeup_id)
      .eq('consumed_visit_id', visitId);
  }
  if (visit.coverage_addon_invoice_id) {
    await admin
      .from('tenant_invoices')
      .update({ status: 'void', updated_at: new Date().toISOString() })
      .eq('id', visit.coverage_addon_invoice_id)
      .eq('tenant_id', membership.tenantId)
      .eq('status', 'open');
  }
  await admin
    .from('tenant_scheduled_visits')
    .update({
      status: 'scheduled',
      completed_at: null,
      completed_by_user_id: null,
      completion_payment_collected: null,
      completion_collected_method: null,
      completion_check_number: null,
      completion_collected_amount_cents: null,
      coverage_status: null,
      coverage_grant_id: null,
      coverage_makeup_id: null,
      coverage_addon_invoice_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', visitId)
    .eq('tenant_id', membership.tenantId);
  revalidatePath(`/schedule/${visitId}`);
  revalidatePath('/schedule');
  redirect(`/schedule/${visitId}`);
}
