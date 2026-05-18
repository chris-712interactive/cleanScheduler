'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { isManualAuditPayment } from '@/lib/billing/manualPaymentAudit';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';

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

  revalidatePaymentAuditPaths();
}

export async function markManualPaymentDeposited(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const paymentId = String(formData.get('payment_id') ?? '').trim();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/payment-audits');

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

  revalidatePaymentAuditPaths();
}
