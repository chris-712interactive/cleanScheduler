import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';
import { isResendConfigured, sendTransactionalEmail } from '@/lib/email/resend';
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal/site';

type Admin = SupabaseClient<Database>;

/** New subscribed tenants are velocity-capped for this many days after `activated_at`. */
export const CONNECT_VELOCITY_NEW_TENANT_DAYS = 14;

/** Rolling window for charge / Checkout-start counts. */
export const CONNECT_VELOCITY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Max Connect card payments (or Checkout starts) per tenant in the window while new. */
export const CONNECT_VELOCITY_MAX_TENANT_PER_WINDOW = 3;

/** Max Connect card payments (or Checkout starts) per customer in the window while new. */
export const CONNECT_VELOCITY_MAX_CUSTOMER_PER_WINDOW = 2;

export const CONNECT_CHECKOUT_STARTED_AUDIT_ACTION = 'connect.checkout_started';
export const CONNECT_VELOCITY_BLOCKED_AUDIT_ACTION = 'connect.velocity_blocked';

export const CONNECT_VELOCITY_TENANT_LIMIT_MESSAGE =
  'Card payments are temporarily limited for new accounts (max 3 successful card charges or checkout attempts per 24 hours). Try again later or contact support if you need a higher limit.';

export const CONNECT_VELOCITY_CUSTOMER_LIMIT_MESSAGE =
  'Card payments for this customer are temporarily limited (max 2 card charges or checkout attempts per 24 hours) while your account is new. Try again later.';

export type ConnectVelocityGateOk = { ok: true };
export type ConnectVelocityGateBlocked = {
  ok: false;
  message: string;
  reason: 'tenant' | 'customer';
};
export type ConnectVelocityGateResult = ConnectVelocityGateOk | ConnectVelocityGateBlocked;

export function isWithinNewTenantVelocityWindow(
  activatedAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!activatedAt) {
    // No activation timestamp — keep caps on (covers odd/legacy rows).
    return true;
  }
  const startMs = new Date(activatedAt).getTime();
  if (Number.isNaN(startMs)) return true;
  return now.getTime() - startMs < CONNECT_VELOCITY_NEW_TENANT_DAYS * 24 * 60 * 60 * 1000;
}

export function evaluateConnectVelocityCounts(counts: {
  tenantPayments: number;
  tenantCheckoutStarts: number;
  customerPayments: number;
  customerCheckoutStarts: number;
}): ConnectVelocityGateResult {
  if (
    counts.tenantPayments >= CONNECT_VELOCITY_MAX_TENANT_PER_WINDOW ||
    counts.tenantCheckoutStarts >= CONNECT_VELOCITY_MAX_TENANT_PER_WINDOW
  ) {
    return { ok: false, reason: 'tenant', message: CONNECT_VELOCITY_TENANT_LIMIT_MESSAGE };
  }

  if (
    counts.customerPayments >= CONNECT_VELOCITY_MAX_CUSTOMER_PER_WINDOW ||
    counts.customerCheckoutStarts >= CONNECT_VELOCITY_MAX_CUSTOMER_PER_WINDOW
  ) {
    return { ok: false, reason: 'customer', message: CONNECT_VELOCITY_CUSTOMER_LIMIT_MESSAGE };
  }

  return { ok: true };
}

function windowStartIso(now: Date): string {
  return new Date(now.getTime() - CONNECT_VELOCITY_WINDOW_MS).toISOString();
}

async function countCardPaymentsInWindow(
  admin: Admin,
  tenantId: string,
  sinceIso: string,
  customerId?: string | null,
): Promise<number> {
  let query = admin
    .from('tenant_invoice_payments')
    .select('id, tenant_invoices!inner(customer_id)', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('method', 'card')
    .gt('amount_cents', 0)
    .gte('recorded_at', sinceIso);

  if (customerId) {
    query = query.eq('tenant_invoices.customer_id', customerId);
  }

  const { count, error } = await query;
  if (error) {
    console.error('[connect-velocity] payment count failed:', error.message);
    // Fail closed for new tenants — better than allowing a burst past the gate.
    return CONNECT_VELOCITY_MAX_TENANT_PER_WINDOW;
  }
  return count ?? 0;
}

async function countCheckoutStartsInWindow(
  admin: Admin,
  tenantId: string,
  sinceIso: string,
  customerId?: string | null,
): Promise<number> {
  const { data, error } = await admin
    .from('audit_log_entries')
    .select('id, payload')
    .eq('action', CONNECT_CHECKOUT_STARTED_AUDIT_ACTION)
    .eq('target_tenant_id', tenantId)
    .gte('created_at', sinceIso);

  if (error) {
    console.error('[connect-velocity] checkout-start count failed:', error.message);
    return CONNECT_VELOCITY_MAX_TENANT_PER_WINDOW;
  }

  if (!customerId) {
    return data?.length ?? 0;
  }

  return (data ?? []).filter((row) => {
    const payload = row.payload as { customer_id?: unknown } | null;
    return payload?.customer_id === customerId;
  }).length;
}

async function notifyOpsVelocityBlocked(options: {
  tenantId: string;
  tenantSlug: string | null;
  customerId: string | null;
  reason: 'tenant' | 'customer';
  counts: {
    tenantPayments: number;
    tenantCheckoutStarts: number;
    customerPayments: number;
    customerCheckoutStarts: number;
  };
}): Promise<void> {
  if (!isResendConfigured()) return;

  const subject = `[Clean Scheduler] Connect velocity limit hit — ${options.tenantSlug ?? options.tenantId}`;
  const text = [
    'A Connect card Checkout was blocked by new-account velocity caps.',
    '',
    `Tenant ID: ${options.tenantId}`,
    `Tenant slug: ${options.tenantSlug ?? '(unknown)'}`,
    `Customer ID: ${options.customerId ?? '(none)'}`,
    `Reason: ${options.reason}`,
    `Tenant card payments (24h): ${options.counts.tenantPayments}`,
    `Tenant checkout starts (24h): ${options.counts.tenantCheckoutStarts}`,
    `Customer card payments (24h): ${options.counts.customerPayments}`,
    `Customer checkout starts (24h): ${options.counts.customerCheckoutStarts}`,
  ].join('\n');

  const html = `<p>A Connect card Checkout was blocked by new-account velocity caps.</p>
<ul>
<li>Tenant: <code>${escapeHtml(options.tenantSlug ?? options.tenantId)}</code></li>
<li>Customer: <code>${escapeHtml(options.customerId ?? '(none)')}</code></li>
<li>Reason: <code>${escapeHtml(options.reason)}</code></li>
<li>Tenant payments / starts: ${options.counts.tenantPayments} / ${options.counts.tenantCheckoutStarts}</li>
<li>Customer payments / starts: ${options.counts.customerPayments} / ${options.counts.customerCheckoutStarts}</li>
</ul>`;

  await sendTransactionalEmail({
    to: LEGAL_CONTACT_EMAIL,
    subject,
    text,
    html,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Enforce Connect card velocity for newly activated tenants.
 * Reserves a durable checkout-start slot on success so parallel sessions cannot bypass caps.
 */
export async function assertConnectPaymentVelocityAllowed(
  admin: Admin,
  options: {
    tenantId: string;
    customerId?: string | null;
    actorUserId?: string | null;
    kind: 'invoice_pay' | 'subscription_checkout';
  },
): Promise<ConnectVelocityGateResult> {
  const now = new Date();
  const { data: billing } = await admin
    .from('tenant_billing_accounts')
    .select('activated_at, status')
    .eq('tenant_id', options.tenantId)
    .maybeSingle();

  // Trial Connect is blocked elsewhere; still apply if somehow active without activated_at.
  if (!isWithinNewTenantVelocityWindow(billing?.activated_at, now)) {
    return { ok: true };
  }

  const sinceIso = windowStartIso(now);
  const customerId = options.customerId?.trim() || null;

  const [tenantPayments, tenantCheckoutStarts, customerPayments, customerCheckoutStarts] =
    await Promise.all([
      countCardPaymentsInWindow(admin, options.tenantId, sinceIso, null),
      countCheckoutStartsInWindow(admin, options.tenantId, sinceIso, null),
      customerId
        ? countCardPaymentsInWindow(admin, options.tenantId, sinceIso, customerId)
        : Promise.resolve(0),
      customerId
        ? countCheckoutStartsInWindow(admin, options.tenantId, sinceIso, customerId)
        : Promise.resolve(0),
    ]);

  const counts = {
    tenantPayments,
    tenantCheckoutStarts,
    customerPayments,
    customerCheckoutStarts,
  };

  const decision = evaluateConnectVelocityCounts(counts);
  if (!decision.ok) {
    const { data: tenant } = await admin
      .from('tenants')
      .select('slug')
      .eq('id', options.tenantId)
      .maybeSingle();

    await admin.from('audit_log_entries').insert({
      actor_user_id: options.actorUserId ?? null,
      action: CONNECT_VELOCITY_BLOCKED_AUDIT_ACTION,
      target_tenant_id: options.tenantId,
      payload: {
        reason: decision.reason,
        kind: options.kind,
        customer_id: customerId,
        counts,
      } as Json,
    });

    void notifyOpsVelocityBlocked({
      tenantId: options.tenantId,
      tenantSlug: tenant?.slug ?? null,
      customerId,
      reason: decision.reason,
      counts,
    });

    return decision;
  }

  await admin.from('audit_log_entries').insert({
    actor_user_id: options.actorUserId ?? null,
    action: CONNECT_CHECKOUT_STARTED_AUDIT_ACTION,
    target_tenant_id: options.tenantId,
    payload: {
      kind: options.kind,
      customer_id: customerId,
    } as Json,
  });

  return { ok: true };
}
