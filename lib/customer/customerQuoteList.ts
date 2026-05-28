import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { QuoteStatus } from '@/lib/tenant/quoteLabels';

export type CustomerQuoteListRow = {
  id: string;
  title: string;
  status: QuoteStatus;
  amount_cents: number | null;
  currency: string;
  created_at: string;
  updated_at: string;
  valid_until: string | null;
  version_number: number;
  customer_id: string | null;
  tenants: { name: string } | null;
};

type AdminClient = SupabaseClient<Database>;

export async function fetchCustomerQuoteList(
  admin: AdminClient,
  customerIds: string[],
): Promise<{ rows: CustomerQuoteListRow[]; error: string | null }> {
  if (customerIds.length === 0) {
    return { rows: [], error: null };
  }

  const { data, error } = await admin
    .from('tenant_quotes')
    .select(
      `
      id,
      title,
      status,
      amount_cents,
      currency,
      created_at,
      updated_at,
      valid_until,
      version_number,
      customer_id,
      tenants:tenants!inner ( name )
    `,
    )
    .in('customer_id', customerIds)
    .neq('status', 'draft')
    .is('superseded_by_quote_id', null)
    .order('updated_at', { ascending: false });

  if (error) {
    return { rows: [], error: error.message };
  }

  return { rows: (data ?? []) as CustomerQuoteListRow[], error: null };
}

export function pendingCustomerQuotes(rows: CustomerQuoteListRow[]): CustomerQuoteListRow[] {
  return rows.filter((row) => row.status === 'sent');
}

export function pastCustomerQuotes(rows: CustomerQuoteListRow[]): CustomerQuoteListRow[] {
  return rows.filter((row) => row.status !== 'sent');
}

/** Lightweight nav-badge query — avoids loading full quote rows in the customer layout. */
export async function countPendingCustomerQuotes(
  admin: AdminClient,
  customerIds: string[],
): Promise<number> {
  if (customerIds.length === 0) return 0;

  const { count, error } = await admin
    .from('tenant_quotes')
    .select('id', { count: 'exact', head: true })
    .in('customer_id', customerIds)
    .eq('status', 'sent')
    .is('superseded_by_quote_id', null);

  if (error) return 0;
  return count ?? 0;
}
