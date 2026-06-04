import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';
import { formatUsdFromCents } from '@/lib/format/money';

type Admin = SupabaseClient<Database>;

type IdentityEmbed = {
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
};

export type PromotionRedemptionAuditRow = {
  id: string;
  status: Database['public']['Enums']['tenant_promotion_redemption_status'];
  customerId: string;
  customerName: string;
  promotionCode: string | null;
  amountLabel: string;
  redeemedAt: string;
  completedAt: string | null;
  quoteId: string | null;
  invoiceId: string | null;
};

export type WalletActivityAuditRow = {
  id: string;
  customerId: string;
  customerName: string;
  kind: Database['public']['Enums']['tenant_customer_wallet_transaction_kind'];
  amountLabel: string;
  balanceAfterLabel: string;
  note: string | null;
  createdAt: string;
};

export type TenantPromotionActivitySnapshot = {
  redemptions: PromotionRedemptionAuditRow[];
  walletTransactions: WalletActivityAuditRow[];
};

const ACTIVITY_LIMIT = 100;

async function customerNameMap(
  admin: Admin,
  tenantId: string,
  customerIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(customerIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const { data, error } = await admin
    .from('customers')
    .select('id, customer_identities ( email, first_name, last_name, full_name )')
    .eq('tenant_id', tenantId)
    .in('id', unique);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const identity = row.customer_identities as IdentityEmbed | null;
    map.set(row.id, identity ? formatCustomerDisplayName(identity) : 'Customer');
  }

  return map;
}

export async function loadTenantPromotionActivity(
  admin: Admin,
  tenantId: string,
): Promise<TenantPromotionActivitySnapshot> {
  const { data: redemptionRows, error: redemptionError } = await admin
    .from('tenant_promotion_redemptions')
    .select(
      `
      id,
      status,
      customer_id,
      promotion_id,
      amount_applied_cents,
      redeemed_at,
      completed_at,
      quote_id,
      invoice_id
    `,
    )
    .eq('tenant_id', tenantId)
    .order('redeemed_at', { ascending: false })
    .limit(ACTIVITY_LIMIT);

  if (redemptionError) throw new Error(redemptionError.message);

  const promotionIds = [...new Set((redemptionRows ?? []).map((row) => row.promotion_id))];
  const promotionCodeMap = new Map<string, string>();
  if (promotionIds.length > 0) {
    const { data: promotions, error: promoError } = await admin
      .from('tenant_promotions')
      .select('id, code')
      .in('id', promotionIds);
    if (promoError) throw new Error(promoError.message);
    for (const promo of promotions ?? []) {
      promotionCodeMap.set(promo.id, promo.code);
    }
  }

  const { data: walletRows, error: walletError } = await admin
    .from('tenant_customer_wallet_transactions')
    .select('id, customer_id, kind, amount_cents, balance_after_cents, note, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(ACTIVITY_LIMIT);

  if (walletError) throw new Error(walletError.message);

  const customerIds = [
    ...(redemptionRows ?? []).map((row) => row.customer_id),
    ...(walletRows ?? []).map((row) => row.customer_id),
  ];
  const names = await customerNameMap(admin, tenantId, customerIds);

  const redemptions: PromotionRedemptionAuditRow[] = (redemptionRows ?? []).map((row) => ({
    id: row.id,
    status: row.status,
    customerId: row.customer_id,
    customerName: names.get(row.customer_id) ?? 'Customer',
    promotionCode: promotionCodeMap.get(row.promotion_id) ?? null,
    amountLabel: formatUsdFromCents(row.amount_applied_cents),
    redeemedAt: row.redeemed_at,
    completedAt: row.completed_at,
    quoteId: row.quote_id,
    invoiceId: row.invoice_id,
  }));

  const walletTransactions: WalletActivityAuditRow[] = (walletRows ?? []).map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    customerName: names.get(row.customer_id) ?? 'Customer',
    kind: row.kind,
    amountLabel: formatUsdFromCents(row.amount_cents),
    balanceAfterLabel: formatUsdFromCents(row.balance_after_cents),
    note: row.note,
    createdAt: row.created_at,
  }));

  return { redemptions, walletTransactions };
}
