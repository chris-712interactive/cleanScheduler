import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  canUsePaidSubscriptionFeatures,
  type TenantBillingStatus,
} from '@/lib/billing/tenantSubscriptionAccess';

export type TenantStripeConnectStatus = Database['public']['Enums']['tenant_stripe_connect_status'];

type Admin = SupabaseClient<Database>;

export const STRIPE_CONNECT_REQUIRES_PAID_SUBSCRIPTION_MESSAGE =
  'Card payments via Stripe require an active subscription. Subscribe under Billing, then connect Stripe to accept cards.';

export const STRIPE_CONNECT_SETUP_REQUIRED_MESSAGE =
  'Connect your Stripe account under Billing → Payment setup before collecting card payments online.';

export function isConnectCompleteForCardPayments(
  status: TenantStripeConnectStatus | null | undefined,
): boolean {
  return status === 'complete';
}

export async function getTenantStripeConnectStatus(
  admin: Admin,
  tenantId: string,
): Promise<TenantStripeConnectStatus> {
  const { data, error } = await admin
    .from('tenants')
    .select('stripe_connect_status')
    .eq('id', tenantId)
    .maybeSingle();

  if (error || !data?.stripe_connect_status) {
    return 'not_started';
  }
  return data.stripe_connect_status;
}

export interface ConnectGateOk {
  ok: true;
  status: TenantStripeConnectStatus;
}

export interface ConnectGateBlocked {
  ok: false;
  status: TenantStripeConnectStatus;
  message: string;
}

export type ConnectGateResult = ConnectGateOk | ConnectGateBlocked;

/**
 * Pure gate used by {@link requireConnectForOnlinePayments} and unit tests.
 * Paid subscription is required before Connect charges (fraud control during trials).
 */
export function evaluateConnectOnlinePaymentsGate(options: {
  billingStatus: TenantBillingStatus | null | undefined;
  connectStatus: TenantStripeConnectStatus;
}): ConnectGateResult {
  if (!canUsePaidSubscriptionFeatures(options.billingStatus)) {
    return {
      ok: false,
      status: options.connectStatus,
      message: STRIPE_CONNECT_REQUIRES_PAID_SUBSCRIPTION_MESSAGE,
    };
  }

  if (isConnectCompleteForCardPayments(options.connectStatus)) {
    return { ok: true, status: options.connectStatus };
  }

  return {
    ok: false,
    status: options.connectStatus,
    message: STRIPE_CONNECT_SETUP_REQUIRED_MESSAGE,
  };
}

/**
 * Card-on-file / Stripe Checkout flows require a paid platform subscription and a
 * fully onboarded Connect Express account. Free trials cannot create or charge via Connect.
 */
export async function requireConnectForOnlinePayments(
  admin: Admin,
  tenantId: string,
): Promise<ConnectGateResult> {
  const [billingRes, status] = await Promise.all([
    admin.from('tenant_billing_accounts').select('status').eq('tenant_id', tenantId).maybeSingle(),
    getTenantStripeConnectStatus(admin, tenantId),
  ]);

  return evaluateConnectOnlinePaymentsGate({
    billingStatus: billingRes.data?.status,
    connectStatus: status,
  });
}
