import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { recordTenantPaymentEvent } from '@/lib/audit/recordTenantPaymentEvent';
import { generatePaymentMatchSuggestions } from '@/lib/plaid/generateMatchSuggestions';
import type { ParsedBankStatementRow } from '@/lib/plaid/parseBankStatementCsv';

type Admin = SupabaseClient<Database>;

async function ensureManualImportBankLink(
  admin: Admin,
  tenantId: string,
): Promise<{ bankLinkId: string; error?: string }> {
  const { data: existing } = await admin
    .from('bank_links')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (existing?.id && existing.status !== 'disconnected') {
    return { bankLinkId: existing.id };
  }

  const row: Database['public']['Tables']['bank_links']['Insert'] = {
    tenant_id: tenantId,
    plaid_item_id: `manual-import:${tenantId}`,
    plaid_access_token: 'manual-import',
    plaid_account_id: 'manual-import',
    institution_name: 'Manual CSV import',
    account_name: 'Imported statement',
    account_mask: '0000',
    status: 'active',
  };

  if (existing?.id) {
    const { error } = await admin.from('bank_links').update(row).eq('id', existing.id);
    if (error) return { bankLinkId: '', error: error.message };
    return { bankLinkId: existing.id };
  }

  const { data, error } = await admin.from('bank_links').insert(row).select('id').single();
  if (error || !data) return { bankLinkId: '', error: error?.message ?? 'Could not create import link.' };
  return { bankLinkId: data.id };
}

export async function importBankStatementRows(
  admin: Admin,
  tenantId: string,
  rows: ParsedBankStatementRow[],
  actorUserId?: string | null,
): Promise<{ imported: number; skipped: number; error?: string }> {
  const credits = rows.filter((row) => row.amountCents < 0 || row.amountCents > 0);
  const normalized = credits.map((row) => ({
    ...row,
    amountCents: row.amountCents > 0 ? -row.amountCents : row.amountCents,
  }));

  if (normalized.length === 0) {
    return { imported: 0, skipped: rows.length, error: 'No credit/deposit rows to import.' };
  }

  const { bankLinkId, error: linkErr } = await ensureManualImportBankLink(admin, tenantId);
  if (linkErr || !bankLinkId) {
    return { imported: 0, skipped: rows.length, error: linkErr ?? 'Could not prepare bank link.' };
  }

  const inserts: Database['public']['Tables']['bank_transactions']['Insert'][] = normalized.map(
    (row) => ({
      tenant_id: tenantId,
      bank_link_id: bankLinkId,
      plaid_transaction_id: row.externalId,
      amount_cents: row.amountCents,
      posted_date: row.postedDate,
      name: row.name,
      merchant_name: row.name,
      payment_channel: 'other',
      pending: false,
      raw: { source: 'csv_import' },
    }),
  );

  const { data, error } = await admin
    .from('bank_transactions')
    .upsert(inserts, { onConflict: 'bank_link_id,plaid_transaction_id', ignoreDuplicates: true })
    .select('id');

  if (error) {
    return { imported: 0, skipped: rows.length, error: error.message };
  }

  await recordTenantPaymentEvent(admin, {
    tenantId,
    action: 'bank.imported',
    actorUserId,
    detail: `Imported ${data?.length ?? normalized.length} bank deposit row(s) from CSV`,
  });

  await generatePaymentMatchSuggestions(admin, tenantId);

  return {
    imported: data?.length ?? normalized.length,
    skipped: Math.max(0, rows.length - (data?.length ?? normalized.length)),
  };
}
