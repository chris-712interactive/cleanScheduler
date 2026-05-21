import type { SupabaseClient } from '@supabase/supabase-js';
import type { Transaction } from 'plaid';
import type { Database, Json } from '@/lib/supabase/database.types';
import { getPlaidClient } from '@/lib/plaid/server';
import { generatePaymentMatchSuggestions } from '@/lib/plaid/generateMatchSuggestions';

type Admin = SupabaseClient<Database>;

function parsePlaidDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function mapTransactionRow(
  tenantId: string,
  bankLinkId: string,
  tx: Transaction,
): Database['public']['Tables']['bank_transactions']['Insert'] {
  return {
    tenant_id: tenantId,
    bank_link_id: bankLinkId,
    plaid_transaction_id: tx.transaction_id,
    amount_cents: Math.round(tx.amount * 100),
    posted_date: parsePlaidDate(tx.date) ?? new Date().toISOString().slice(0, 10),
    authorized_date: parsePlaidDate(tx.authorized_date),
    name: tx.name ?? null,
    merchant_name: tx.merchant_name ?? null,
    payment_channel: tx.payment_channel ?? null,
    pending: tx.pending ?? false,
    iso_currency_code: tx.iso_currency_code ?? 'USD',
    raw: tx as unknown as Json,
  };
}

export async function syncBankTransactionsForTenant(
  admin: Admin,
  tenantId: string,
): Promise<{ added: number; modified: number; removed: number }> {
  const { data: link, error: linkErr } = await admin
    .from('bank_links')
    .select('id, plaid_access_token, transactions_cursor, status')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (linkErr) throw new Error(linkErr.message);
  if (!link) {
    return { added: 0, modified: 0, removed: 0 };
  }

  const client = getPlaidClient();
  let cursor = link.transactions_cursor ?? undefined;
  let added = 0;
  let modified = 0;
  let removed = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await client.transactionsSync({
        access_token: link.plaid_access_token,
        cursor,
      });

      const data = response.data;

      if (data.added.length > 0) {
        const rows = data.added.map((tx) => mapTransactionRow(tenantId, link.id, tx));
        const { error } = await admin.from('bank_transactions').upsert(rows, {
          onConflict: 'bank_link_id,plaid_transaction_id',
        });
        if (error) throw new Error(error.message);
        added += data.added.length;
      }

      if (data.modified.length > 0) {
        const rows = data.modified.map((tx) => mapTransactionRow(tenantId, link.id, tx));
        const { error } = await admin.from('bank_transactions').upsert(rows, {
          onConflict: 'bank_link_id,plaid_transaction_id',
        });
        if (error) throw new Error(error.message);
        modified += data.modified.length;
      }

      if (data.removed.length > 0) {
        const ids = data.removed.map((r) => r.transaction_id);
        const { error } = await admin
          .from('bank_transactions')
          .delete()
          .eq('bank_link_id', link.id)
          .in('plaid_transaction_id', ids);
        if (error) throw new Error(error.message);
        removed += data.removed.length;
      }

      cursor = data.next_cursor;
      hasMore = data.has_more;
    }

    await admin
      .from('bank_links')
      .update({
        transactions_cursor: cursor ?? null,
        last_synced_at: new Date().toISOString(),
        last_sync_error: null,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', link.id);

    await generatePaymentMatchSuggestions(admin, tenantId);

    return { added, modified, removed };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Plaid sync failed';
    await admin
      .from('bank_links')
      .update({
        last_sync_error: message,
        status: message.toLowerCase().includes('login') ? 'login_required' : link.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', link.id);
    throw e;
  }
}

export async function syncAllBankLinks(admin: Admin): Promise<{ tenants: number; errors: number }> {
  const { data: links } = await admin.from('bank_links').select('tenant_id').eq('status', 'active');

  let errors = 0;
  for (const link of links ?? []) {
    try {
      await syncBankTransactionsForTenant(admin, link.tenant_id);
    } catch {
      errors += 1;
    }
  }

  return { tenants: links?.length ?? 0, errors };
}
