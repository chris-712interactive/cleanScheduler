'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { isManualAuditPayment } from '@/lib/billing/manualPaymentAudit';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { tenantRoleError } from '@/lib/auth/tenantRoleAccess';
import { getAuthContext } from '@/lib/auth/session';
import { recordTenantPaymentEvent } from '@/lib/audit/recordTenantPaymentEvent';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function revalidatePaymentAuditPaths() {
  revalidatePath('/billing/payment-audits');
  revalidatePath('/billing/transactions');
  revalidatePath('/billing/invoices');
}

async function loadAuditablePayment(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  paymentId: string,
) {
  const { data, error } = await admin
    .from('tenant_invoice_payments')
    .select('id, tenant_id, recorded_via, method, received_at, deposited_at')
    .eq('id', paymentId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data) return { error: 'Payment not found.' as const };
  if (!isManualAuditPayment(data)) {
    return { error: 'Only offline manual payments can be audited here.' as const };
  }
  return { payment: data };
}

export async function markManualPaymentReceived(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const paymentId = String(formData.get('payment_id') ?? '').trim();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/payment-audits');
  const roleErr = tenantRoleError(membership.role, 'employee');
  if (roleErr) return;

  if (!UUID_RE.test(paymentId)) return;

  const admin = createAdminClient();
  const loaded = await loadAuditablePayment(admin, membership.tenantId, paymentId);
  if ('error' in loaded) return;
  if (loaded.payment.received_at) return;

  const auth = await getAuthContext();
  const now = new Date().toISOString();

  await admin
    .from('tenant_invoice_payments')
    .update({
      received_at: now,
      received_by_user_id: auth?.user?.id ?? null,
    })
    .eq('id', paymentId)
    .eq('tenant_id', membership.tenantId);

  await recordTenantPaymentEvent(admin, {
    tenantId: membership.tenantId,
    paymentId,
    actorUserId: auth?.user?.id ?? null,
    action: 'payment.received',
    detail: 'Marked received in payment audits',
  });

  revalidatePaymentAuditPaths();
}

export async function markManualPaymentDeposited(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const paymentId = String(formData.get('payment_id') ?? '').trim();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/payment-audits');
  const roleErr = tenantRoleError(membership.role, 'employee');
  if (roleErr) return;

  if (!UUID_RE.test(paymentId)) return;

  const admin = createAdminClient();
  const loaded = await loadAuditablePayment(admin, membership.tenantId, paymentId);
  if ('error' in loaded) return;
  if (!loaded.payment.received_at) return;
  if (loaded.payment.deposited_at) return;

  const auth = await getAuthContext();
  const now = new Date().toISOString();

  await admin
    .from('tenant_invoice_payments')
    .update({
      deposited_at: now,
      deposited_by_user_id: auth?.user?.id ?? null,
    })
    .eq('id', paymentId)
    .eq('tenant_id', membership.tenantId);

  await recordTenantPaymentEvent(admin, {
    tenantId: membership.tenantId,
    paymentId,
    actorUserId: auth?.user?.id ?? null,
    action: 'payment.deposited',
    detail: 'Marked deposited in payment audits',
  });

  revalidatePaymentAuditPaths();
}

export async function markManualPaymentCleared(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const paymentId = String(formData.get('payment_id') ?? '').trim();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/payment-audits');
  const roleErr = tenantRoleError(membership.role, 'employee');
  if (roleErr) return;

  if (!UUID_RE.test(paymentId)) return;

  const admin = createAdminClient();
  const loaded = await loadAuditablePayment(admin, membership.tenantId, paymentId);
  if ('error' in loaded) return;
  if (loaded.payment.method !== 'check') return;
  if (!loaded.payment.received_at || !loaded.payment.deposited_at) return;

  const { data: existing } = await admin
    .from('tenant_invoice_payments')
    .select('cleared_at, bounced_at')
    .eq('id', paymentId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (existing?.cleared_at || existing?.bounced_at) return;

  const auth = await getAuthContext();
  const now = new Date().toISOString();

  await admin
    .from('tenant_invoice_payments')
    .update({
      cleared_at: now,
      cleared_by_user_id: auth?.user?.id ?? null,
    })
    .eq('id', paymentId)
    .eq('tenant_id', membership.tenantId);

  await recordTenantPaymentEvent(admin, {
    tenantId: membership.tenantId,
    paymentId,
    actorUserId: auth?.user?.id ?? null,
    action: 'payment.cleared',
    detail: 'Check marked cleared in payment audits',
  });

  revalidatePaymentAuditPaths();
}

export async function markManualPaymentBounced(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const paymentId = String(formData.get('payment_id') ?? '').trim();
  const bounceReason = String(formData.get('bounce_reason') ?? '').trim() || null;
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/payment-audits');
  const roleErr = tenantRoleError(membership.role, 'employee');
  if (roleErr) return;

  if (!UUID_RE.test(paymentId)) return;

  const admin = createAdminClient();
  const loaded = await loadAuditablePayment(admin, membership.tenantId, paymentId);
  if ('error' in loaded) return;
  if (loaded.payment.method !== 'check') return;
  if (!loaded.payment.received_at) return;

  const { data: existing } = await admin
    .from('tenant_invoice_payments')
    .select('cleared_at, bounced_at')
    .eq('id', paymentId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (existing?.cleared_at || existing?.bounced_at) return;

  const auth = await getAuthContext();
  const now = new Date().toISOString();

  await admin
    .from('tenant_invoice_payments')
    .update({
      bounced_at: now,
      bounce_reason: bounceReason,
    })
    .eq('id', paymentId)
    .eq('tenant_id', membership.tenantId);

  await recordTenantPaymentEvent(admin, {
    tenantId: membership.tenantId,
    paymentId,
    actorUserId: auth?.user?.id ?? null,
    action: 'payment.bounced',
    detail: bounceReason ? `Check bounced: ${bounceReason}` : 'Check marked bounced in payment audits',
  });

  revalidatePaymentAuditPaths();
}
