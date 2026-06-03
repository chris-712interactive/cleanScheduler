import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import type { CustomerTenantLink } from '@/lib/customer/customerContext';
import { getCustomerWalletBalanceCents } from '@/lib/promotions/customerWallet';

type Admin = SupabaseClient<Database>;

export type CustomerWalletTransactionView = {
  id: string;
  kind: Database['public']['Enums']['tenant_customer_wallet_transaction_kind'];
  amountCents: number;
  balanceAfterCents: number;
  note: string | null;
  createdAt: string;
};

export type CustomerWalletPortalView = {
  tenantId: string;
  tenantName: string;
  balanceCents: number;
  recentTransactions: CustomerWalletTransactionView[];
};

export async function customerPromotionsEnabledForTenant(
  admin: Admin,
  tenantId: string,
): Promise<boolean> {
  const plan = await resolveTenantEntitlementPlan(admin, tenantId);
  return isFeatureEnabled(plan, 'customerPromotions');
}

export async function loadCustomerWalletPortalView(
  admin: Admin,
  link: CustomerTenantLink,
  options?: { transactionLimit?: number },
): Promise<CustomerWalletPortalView | null> {
  const enabled = await customerPromotionsEnabledForTenant(admin, link.tenantId);
  if (!enabled) return null;

  const limit = options?.transactionLimit ?? 5;
  const balanceCents = await getCustomerWalletBalanceCents(admin, link.tenantId, link.customerId);

  const { data: rows, error } = await admin
    .from('tenant_customer_wallet_transactions')
    .select('id, kind, amount_cents, balance_after_cents, note, created_at')
    .eq('tenant_id', link.tenantId)
    .eq('customer_id', link.customerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const recentTransactions: CustomerWalletTransactionView[] = (rows ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    amountCents: row.amount_cents,
    balanceAfterCents: row.balance_after_cents,
    note: row.note,
    createdAt: row.created_at,
  }));

  return {
    tenantId: link.tenantId,
    tenantName: link.tenantName,
    balanceCents,
    recentTransactions,
  };
}

export async function loadCustomerWalletSummariesForLinks(
  admin: Admin,
  links: CustomerTenantLink[],
): Promise<CustomerWalletPortalView[]> {
  const views = await Promise.all(
    links.map((link) => loadCustomerWalletPortalView(admin, link, { transactionLimit: 0 })),
  );
  return views.filter((view): view is CustomerWalletPortalView => view != null);
}
