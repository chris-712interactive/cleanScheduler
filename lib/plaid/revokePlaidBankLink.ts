import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getPlaidClient, isPlaidConfigured } from '@/lib/plaid/server';

type Admin = SupabaseClient<Database>;

export const MANUAL_IMPORT_ACCESS_TOKEN = 'manual-import';
export const REVOKED_ACCESS_TOKEN = 'revoked';

export type RevokePlaidBankLinkReason =
  | 'tenant_disconnected'
  | 'subscription_canceled'
  | 'workspace_purged'
  | 'trial_expired';

export interface RevokePlaidBankLinkResult {
  found: boolean;
  revoked: boolean;
  plaidItemRemoved: boolean;
}

function isManualImportLink(link: {
  plaid_access_token: string;
  plaid_item_id: string;
}): boolean {
  return (
    link.plaid_access_token === MANUAL_IMPORT_ACCESS_TOKEN ||
    link.plaid_item_id.startsWith('manual-import:')
  );
}

function shouldRemovePlaidItem(link: {
  plaid_access_token: string;
  plaid_item_id: string;
  status: Database['public']['Enums']['bank_link_status'];
}): boolean {
  if (link.status === 'disconnected') return false;
  if (link.plaid_access_token === REVOKED_ACCESS_TOKEN) return false;
  return !isManualImportLink(link);
}

/**
 * Revokes a tenant's Plaid bank link: calls Plaid /item/remove when applicable and
 * marks the local row disconnected (unless the tenant row will cascade-delete it).
 */
export async function revokePlaidBankLink(
  admin: Admin,
  tenantId: string,
  options?: {
    reason?: RevokePlaidBankLinkReason;
    /** Skip DB update when tenant deletion will cascade-remove bank_links. */
    skipLocalUpdate?: boolean;
  },
): Promise<RevokePlaidBankLinkResult> {
  const { data: link } = await admin
    .from('bank_links')
    .select('id, plaid_access_token, plaid_item_id, status')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!link) {
    return { found: false, revoked: false, plaidItemRemoved: false };
  }

  if (link.status === 'disconnected') {
    return { found: true, revoked: false, plaidItemRemoved: false };
  }

  const manualImport = isManualImportLink(link);
  let plaidItemRemoved = false;

  if (shouldRemovePlaidItem(link) && isPlaidConfigured()) {
    try {
      const client = getPlaidClient();
      await client.itemRemove({ access_token: link.plaid_access_token });
      plaidItemRemoved = true;
    } catch {
      // Best-effort; still mark revoked locally when persisting state.
    }
  }

  if (options?.skipLocalUpdate) {
    return {
      found: true,
      revoked: plaidItemRemoved || manualImport,
      plaidItemRemoved,
    };
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from('bank_links')
    .update({
      status: 'disconnected',
      plaid_access_token: manualImport ? MANUAL_IMPORT_ACCESS_TOKEN : REVOKED_ACCESS_TOKEN,
      updated_at: now,
    })
    .eq('id', link.id);

  if (error) {
    throw new Error(error.message);
  }

  return {
    found: true,
    revoked: true,
    plaidItemRemoved,
  };
}
