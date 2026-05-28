import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { customerLabelFromIdentity } from '@/lib/reports/customerLabel';
import type { ReportSummaryLine } from '@/lib/reports/types';
import { formatUsdFromCents } from '@/lib/format/money';

export type BankDepositMatchStatus = 'unmatched' | 'matched' | 'pending';

export interface BankReconciliationRow {
  transactionId: string;
  postedDate: string;
  name: string;
  amountCents: number;
  matchStatus: BankDepositMatchStatus;
  invoiceId: string | null;
  invoiceTitle: string | null;
  customerName: string | null;
  paymentId: string | null;
  openSuggestions: number;
  bankConnectionHref: string;
  invoiceHref: string | null;
}

export interface BankReconciliationResult {
  rows: BankReconciliationRow[];
  summary: ReportSummaryLine[];
  hasBankLink: boolean;
}

export async function runBankReconciliationReport(
  db: SupabaseClient<Database>,
  tenantId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<BankReconciliationResult> {
  const { data: link } = await db
    .from('bank_links')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const hasBankLink = Boolean(link && link.status !== 'disconnected');

  let query = db
    .from('bank_transactions')
    .select(
      `
      id,
      posted_date,
      name,
      merchant_name,
      amount_cents,
      pending,
      matched_payment_id,
      tenant_invoice_payments (
        id,
        invoice_id,
        tenant_invoices (
          id,
          title,
          customers (
            customer_identities (
              first_name,
              last_name,
              full_name
            )
          )
        )
      )
    `,
    )
    .eq('tenant_id', tenantId)
    .lt('amount_cents', 0)
    .order('posted_date', { ascending: false });

  if (fromIso) query = query.gte('posted_date', fromIso.slice(0, 10));
  if (toIso) query = query.lte('posted_date', toIso.slice(0, 10));

  const { data: transactions, error } = await query.limit(500);
  if (error || !transactions) {
    return {
      rows: [],
      summary: [{ label: 'Bank deposits', value: '0' }],
      hasBankLink,
    };
  }

  const txIds = transactions.map((tx) => tx.id);
  const { data: suggestions } =
    txIds.length > 0
      ? await db
          .from('payment_match_suggestions')
          .select('bank_transaction_id')
          .eq('tenant_id', tenantId)
          .eq('status', 'suggested')
          .in('bank_transaction_id', txIds)
      : { data: [] as { bank_transaction_id: string }[] };

  const suggestionCountByTx = new Map<string, number>();
  for (const row of suggestions ?? []) {
    suggestionCountByTx.set(
      row.bank_transaction_id,
      (suggestionCountByTx.get(row.bank_transaction_id) ?? 0) + 1,
    );
  }

  let matchedCount = 0;
  let unmatchedCount = 0;
  let pendingCount = 0;
  let depositTotalCents = 0;

  const rows: BankReconciliationRow[] = transactions.map((tx) => {
    const creditCents = Math.abs(tx.amount_cents);
    depositTotalCents += creditCents;

    let matchStatus: BankDepositMatchStatus = 'unmatched';
    if (tx.pending) {
      matchStatus = 'pending';
      pendingCount += 1;
    } else if (tx.matched_payment_id) {
      matchStatus = 'matched';
      matchedCount += 1;
    } else {
      unmatchedCount += 1;
    }

    const payment = tx.tenant_invoice_payments;
    const invoice = payment?.tenant_invoices ?? null;
    const ident = invoice?.customers?.customer_identities ?? null;

    return {
      transactionId: tx.id,
      postedDate: tx.posted_date,
      name: tx.name ?? tx.merchant_name ?? 'Bank deposit',
      amountCents: creditCents,
      matchStatus,
      invoiceId: invoice?.id ?? null,
      invoiceTitle: invoice?.title ?? null,
      customerName: ident ? customerLabelFromIdentity(ident) : null,
      paymentId: payment?.id ?? tx.matched_payment_id ?? null,
      openSuggestions: suggestionCountByTx.get(tx.id) ?? 0,
      bankConnectionHref: '/billing/bank-connection',
      invoiceHref: invoice?.id ? `/billing/invoices/${invoice.id}` : null,
    };
  });

  return {
    rows,
    hasBankLink,
    summary: [
      { label: 'Bank deposits', value: String(rows.length) },
      { label: 'Deposit total', value: formatUsdFromCents(depositTotalCents) },
      { label: 'Matched', value: String(matchedCount) },
      { label: 'Unmatched', value: String(unmatchedCount) },
      { label: 'Pending', value: String(pendingCount) },
    ],
  };
}

export function bankDepositMatchStatusLabel(status: BankDepositMatchStatus): string {
  if (status === 'matched') return 'Matched';
  if (status === 'pending') return 'Pending';
  return 'Unmatched';
}
