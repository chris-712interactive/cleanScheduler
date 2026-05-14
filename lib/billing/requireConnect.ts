import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export type TenantStripeConnectStatus = Database['public']['Enums']['tenant_stripe_connect_status'];

type Admin = SupabaseClient<Database>;

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
 * Card-on-file / Stripe Checkout flows require Connect Express to be fully onboarded.
 */
export async function requireConnectForOnlinePayments(
  admin: Admin,
  tenantId: string,
): Promise<ConnectGateResult> {
  const status = await getTenantStripeConnectStatus(admin, tenantId);
  if (isConnectCompleteForCardPayments(status)) {
    return { ok: true, status };
  }
  return {
    ok: false,
    status,
    message:
      'Connect your Stripe account under Billing → Payment setup before collecting card payments online.',
  };
}
