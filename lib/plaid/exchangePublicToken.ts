import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { isOutboundSuppressed, OutboundSuppressedError } from '@/lib/outbound/suppression';
import { getPlaidClient } from '@/lib/plaid/server';
import { tryRemovePlaidLinkItem } from '@/lib/plaid/revokePlaidBankLink';
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
  if (isOutboundSuppressed()) {
    throw new OutboundSuppressedError();
  }

  const { data: existing } = await admin
    .from('bank_links')
    .select('id, plaid_access_token, plaid_item_id, status')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const client = getPlaidClient();
  const exchange = await client.itemPublicTokenExchange({ public_token: publicToken });
  const accessToken = exchange.data.access_token;
  const itemId = exchange.data.item_id;

  const accountsRes = await client.accountsGet({ access_token: accessToken });
  const plaidAccount = accountsRes.data.accounts.find((row) => row.account_id === account.id);
  if (!plaidAccount) {
    throw new Error('Selected bank account was not found on the Plaid item.');
  }
  const institutionId = institution?.institution_id ?? accountsRes.data.item.institution_id ?? null;
  const accountName = account.name || plaidAccount.name || null;
  const accountMask = account.mask || plaidAccount.mask || null;
  const accountType = account.type || plaidAccount.type || null;
  const accountSubtype = account.subtype || plaidAccount.subtype || null;

  // Replace flow: new Plaid Item — revoke the previous Item before overwriting our row.
  if (existing && existing.plaid_item_id !== itemId) {
    await tryRemovePlaidLinkItem(existing);
  }

  const now = new Date().toISOString();
  const row: Database['public']['Tables']['bank_links']['Insert'] = {
    tenant_id: tenantId,
    plaid_item_id: itemId,
    plaid_access_token: accessToken,
    plaid_institution_id: institutionId,
    institution_name: institution?.name ?? null,
    plaid_account_id: account.id,
    account_name: accountName,
    account_mask: accountMask,
    account_type: accountType,
    account_subtype: accountSubtype,
    status: 'active',
    transactions_cursor: null,
    last_synced_at: null,
    last_sync_error: null,
    updated_at: now,
  };

  if (existing?.id) {
    const { error } = await admin.from('bank_links').update(row).eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin.from('bank_links').insert(row);
    if (error) throw new Error(error.message);
  }

  await syncBankTransactionsForTenant(admin, tenantId);
}
