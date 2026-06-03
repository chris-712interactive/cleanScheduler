import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

export async function getCustomerWalletBalanceCents(
  admin: Admin,
  tenantId: string,
  customerId: string,
): Promise<number> {
  const { data, error } = await admin
    .from('tenant_customer_wallets')
    .select('balance_cents')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.balance_cents ?? 0;
}

async function upsertWalletBalance(
  admin: Admin,
  tenantId: string,
  customerId: string,
  nextBalance: number,
): Promise<void> {
  const { error } = await admin.from('tenant_customer_wallets').upsert(
    {
      tenant_id: tenantId,
      customer_id: customerId,
      balance_cents: nextBalance,
    },
    { onConflict: 'tenant_id,customer_id' },
  );
  if (error) throw new Error(error.message);
}

export async function grantCustomerWalletCredit(
  admin: Admin,
  input: {
    tenantId: string;
    customerId: string;
    amountCents: number;
    kind?: Database['public']['Enums']['tenant_customer_wallet_transaction_kind'];
    promotionId?: string | null;
    promotionRedemptionId?: string | null;
    quoteId?: string | null;
    note?: string | null;
  },
): Promise<{ balanceAfterCents: number; transactionId: string }> {
  const amount = Math.round(input.amountCents);
  if (amount <= 0) {
    throw new Error('Credit amount must be positive.');
  }

  const current = await getCustomerWalletBalanceCents(admin, input.tenantId, input.customerId);
  const next = current + amount;

  const { data: tx, error: txError } = await admin
    .from('tenant_customer_wallet_transactions')
    .insert({
      tenant_id: input.tenantId,
      customer_id: input.customerId,
      kind: input.kind ?? 'credit_grant',
      amount_cents: amount,
      balance_after_cents: next,
      promotion_id: input.promotionId ?? null,
      promotion_redemption_id: input.promotionRedemptionId ?? null,
      quote_id: input.quoteId ?? null,
      note: input.note ?? null,
    })
    .select('id')
    .single();

  if (txError) throw new Error(txError.message);

  await upsertWalletBalance(admin, input.tenantId, input.customerId, next);

  return { balanceAfterCents: next, transactionId: tx.id };
}

export async function debitCustomerWalletCredit(
  admin: Admin,
  input: {
    tenantId: string;
    customerId: string;
    amountCents: number;
    kind?: Database['public']['Enums']['tenant_customer_wallet_transaction_kind'];
    quoteId?: string | null;
    note?: string | null;
  },
): Promise<{ balanceAfterCents: number; transactionId: string }> {
  const amount = Math.round(input.amountCents);
  if (amount <= 0) {
    throw new Error('Debit amount must be positive.');
  }

  const current = await getCustomerWalletBalanceCents(admin, input.tenantId, input.customerId);
  if (current < amount) {
    throw new Error('Insufficient wallet balance.');
  }

  const next = current - amount;

  const { data: tx, error: txError } = await admin
    .from('tenant_customer_wallet_transactions')
    .insert({
      tenant_id: input.tenantId,
      customer_id: input.customerId,
      kind: input.kind ?? 'credit_apply',
      amount_cents: amount,
      balance_after_cents: next,
      quote_id: input.quoteId ?? null,
      note: input.note ?? null,
    })
    .select('id')
    .single();

  if (txError) throw new Error(txError.message);

  await upsertWalletBalance(admin, input.tenantId, input.customerId, next);

  return { balanceAfterCents: next, transactionId: tx.id };
}
