import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type InvoiceBalanceRow = {
  amount_cents: number;
  amount_paid_cents: number;
  status: string;
  due_date: string | null;
};

export function invoiceRemainingCents(row: {
  amount_cents: number;
  amount_paid_cents: number;
}): number {
  return Math.max(0, row.amount_cents - row.amount_paid_cents);
}

export function sumOutstandingInvoiceBalances(rows: InvoiceBalanceRow[]): {
  totalCents: number;
  invoiceCount: number;
  pastDueCount: number;
} {
  const now = Date.now();
  let totalCents = 0;
  let invoiceCount = 0;
  let pastDueCount = 0;

  for (const row of rows) {
    if (row.status === 'void') continue;
    const remaining = invoiceRemainingCents(row);
    if (remaining <= 0) continue;

    totalCents += remaining;
    invoiceCount += 1;

    if (row.due_date && new Date(row.due_date).getTime() < now) {
      pastDueCount += 1;
    }
  }

  return { totalCents, invoiceCount, pastDueCount };
}

export async function getTenantOutstandingInvoicesSummary(
  db: SupabaseClient<Database>,
  tenantId: string,
): Promise<{ totalCents: number; invoiceCount: number; pastDueCount: number }> {
  const { data, error } = await db
    .from('tenant_invoices')
    .select('amount_cents, amount_paid_cents, status, due_date')
    .eq('tenant_id', tenantId)
    .neq('status', 'void');

  if (error || !data) {
    return { totalCents: 0, invoiceCount: 0, pastDueCount: 0 };
  }

  return sumOutstandingInvoiceBalances(data);
}
