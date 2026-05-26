import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

export type TenantPaymentEventAction =
  | 'payment.recorded'
  | 'payment.received'
  | 'payment.deposited'
  | 'payment.cleared'
  | 'payment.bounced'
  | 'bank.matched'
  | 'bank.imported';

export async function recordTenantPaymentEvent(
  admin: Admin,
  params: {
    tenantId: string;
    action: TenantPaymentEventAction;
    paymentId?: string | null;
    invoiceId?: string | null;
    bankTransactionId?: string | null;
    actorUserId?: string | null;
    detail?: string | null;
  },
): Promise<void> {
  const { error } = await admin.from('tenant_payment_events').insert({
    tenant_id: params.tenantId,
    action: params.action,
    payment_id: params.paymentId ?? null,
    invoice_id: params.invoiceId ?? null,
    bank_transaction_id: params.bankTransactionId ?? null,
    actor_user_id: params.actorUserId ?? null,
    detail: params.detail?.trim() || null,
  });

  if (error) {
    console.error('[recordTenantPaymentEvent]', error.message);
  }
}

export async function fetchPaymentEventSummaries(
  db: SupabaseClient<Database>,
  tenantId: string,
  paymentIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (paymentIds.length === 0) return map;

  const { data } = await db
    .from('tenant_payment_events')
    .select('payment_id, action, detail, created_at')
    .eq('tenant_id', tenantId)
    .in('payment_id', paymentIds)
    .order('created_at', { ascending: true });

  for (const row of data ?? []) {
    if (!row.payment_id) continue;
    const stamp = new Date(row.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const label = row.detail?.trim() || row.action.replace('.', ' ');
    const line = `${stamp}: ${label}`;
    const existing = map.get(row.payment_id);
    map.set(row.payment_id, existing ? `${existing}; ${line}` : line);
  }

  return map;
}
