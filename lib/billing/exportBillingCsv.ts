import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { formatInvoiceReference } from '@/lib/billing/formatInvoiceReference';
import { formatInvoiceListDate, invoiceListStatusLabel } from '@/lib/billing/invoiceListDisplay';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';
import { formatUsdFromCents } from '@/lib/format/money';
import { rowsToCsv, type CsvColumn } from '@/lib/reports/toCsv';

type InvoiceExportRow = {
  reference: string;
  customer: string;
  status: string;
  total: string;
  created: string;
};

type TransactionExportRow = {
  posted: string;
  customer: string;
  invoice: string;
  method: string;
  source: string;
  amount: string;
};

export async function exportInvoicesCsv(
  db: SupabaseClient<Database>,
  tenantId: string,
): Promise<string> {
  const { data } = await db
    .from('tenant_invoices')
    .select(
      `
      id,
      title,
      status,
      amount_cents,
      created_at,
      customers (
        customer_identities (
          first_name,
          last_name,
          full_name
        )
      )
    `,
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(5000);

  const rows: InvoiceExportRow[] = (data ?? []).map((row) => {
    const ident = (row.customers as { customer_identities: Parameters<typeof formatCustomerDisplayName>[0] | null } | null)
      ?.customer_identities;
    const customer =
      ident && customerHasAnyNameParts(ident) ? formatCustomerDisplayName(ident) : '—';
    return {
      reference: formatInvoiceReference(row.id, row.title),
      customer: customer === 'Unnamed' ? '—' : customer,
      status: invoiceListStatusLabel(row.status),
      total: formatUsdFromCents(row.amount_cents),
      created: formatInvoiceListDate(row.created_at),
    };
  });

  const columns: CsvColumn<InvoiceExportRow>[] = [
    { key: 'reference', header: 'Invoice', format: (r) => r.reference },
    { key: 'customer', header: 'Customer', format: (r) => r.customer },
    { key: 'status', header: 'Status', format: (r) => r.status },
    { key: 'total', header: 'Total', format: (r) => r.total },
    { key: 'created', header: 'Created', format: (r) => r.created },
  ];

  return rowsToCsv(columns, rows);
}

export async function exportTransactionsCsv(
  db: SupabaseClient<Database>,
  tenantId: string,
): Promise<string> {
  const { data } = await db
    .from('tenant_invoice_payments')
    .select(
      `
      amount_cents,
      method,
      recorded_at,
      recorded_via,
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
    `,
    )
    .eq('tenant_id', tenantId)
    .order('recorded_at', { ascending: false })
    .limit(5000);

  const rows: TransactionExportRow[] = (data ?? []).map((row) => {
    const inv = row.tenant_invoices as {
      id: string;
      title: string;
      customers: { customer_identities: Parameters<typeof formatCustomerDisplayName>[0] | null } | null;
    } | null;
    const ident = inv?.customers?.customer_identities;
    const customer =
      ident && customerHasAnyNameParts(ident) ? formatCustomerDisplayName(ident) : '—';
    return {
      posted: formatInvoiceListDate(row.recorded_at),
      customer: customer === 'Unnamed' ? '—' : customer,
      invoice: inv ? formatInvoiceReference(inv.id, inv.title) : '—',
      method: row.method,
      source: row.recorded_via === 'stripe_checkout' ? 'Stripe Checkout' : 'Manual',
      amount: formatUsdFromCents(row.amount_cents),
    };
  });

  const columns: CsvColumn<TransactionExportRow>[] = [
    { key: 'posted', header: 'Posted', format: (r) => r.posted },
    { key: 'customer', header: 'Customer', format: (r) => r.customer },
    { key: 'invoice', header: 'Invoice', format: (r) => r.invoice },
    { key: 'method', header: 'Method', format: (r) => r.method },
    { key: 'source', header: 'Source', format: (r) => r.source },
    { key: 'amount', header: 'Amount', format: (r) => r.amount },
  ];

  return rowsToCsv(columns, rows);
}
