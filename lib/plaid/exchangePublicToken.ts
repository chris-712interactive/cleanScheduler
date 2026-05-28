import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getPlaidClient } from '@/lib/plaid/server';
import { syncBankTransactionsForTenant } from '@/lib/plaid/syncBankTransactions';

type Admin = SupabaseClient<Database>;

export interface PlaidLinkAccountMetadata {
  id: string;
  name: string;
  mask: string;
  type: string;
  subtype: string;
}

export interface PlaidLinkInstitutionMetadata {
  name: string;
  institution_id: string;
}

export async function exchangeAndSaveBankLink(
  admin: Admin,
  tenantId: string,
  publicToken: string,
  account: PlaidLinkAccountMetadata,
  institution: PlaidLinkInstitutionMetadata | null,
): Promise<void> {
  const client = getPlaidClient();
  const exchange = await client.itemPublicTokenExchange({ public_token: publicToken });
  const accessToken = exchange.data.access_token;
  const itemId = exchange.data.item_id;

  const accountsRes = await client.accountsGet({ access_token: accessToken });
  const plaidAccount = accountsRes.data.accounts.find((row) => row.account_id === account.id);
  if (!plaidAccount) {
    throw new Error('Selected bank account was not found on the Plaid item.');
  }

  const now = new Date().toISOString();
  const row: Database['public']['Tables']['bank_links']['Insert'] = {
    tenant_id: tenantId,
    plaid_item_id: itemId,
    plaid_access_token: accessToken,
    plaid_institution_id:
      institution?.institution_id ?? accountsRes.data.item.institution_id ?? null,
    institution_name: institution?.name ?? null,
    plaid_account_id: account.id,
    account_name: account.name || plaidAccount.name || null,
    account_mask: account.mask || plaidAccount.mask || null,
    account_type: account.type || plaidAccount.type || null,
    account_subtype: account.subtype || plaidAccount.subtype || null,
    status: 'active',
    transactions_cursor: null,
    last_synced_at: null,
    last_sync_error: null,
    updated_at: now,
  };

  const { data: existing } = await admin
    .from('bank_links')
    .select('id')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await admin.from('bank_links').update(row).eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin.from('bank_links').insert(row);
    if (error) throw new Error(error.message);
  }

  await syncBankTransactionsForTenant(admin, tenantId);
}
