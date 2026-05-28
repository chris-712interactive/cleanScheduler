import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { invoiceRemainingCents } from '@/lib/billing/outstandingInvoices';
import { daysOutstanding } from '@/lib/reports/aging';
import { customerLabelFromIdentity } from '@/lib/reports/customerLabel';
import type { ReportSummaryLine } from '@/lib/reports/types';
import { formatUsdFromCents } from '@/lib/format/money';
import { manualPaymentMethodLabel } from '@/lib/billing/manualPaymentAudit';

export interface InvoiceAuditRow {
  invoiceId: string;
  customerName: string;
  title: string;
  status: string;
  createdAt: string;
  dueDate: string | null;
  amountCents: number;
  paidCents: number;
  remainingCents: number;
  daysOutstanding: number | null;
  paymentMethods: string;
  invoiceHref: string;
  paymentAuditHref: string;
}

export interface InvoiceAuditResult {
  rows: InvoiceAuditRow[];
  summary: ReportSummaryLine[];
}

export async function runInvoiceAuditReport(
  db: SupabaseClient<Database>,
  tenantId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<InvoiceAuditResult> {
  let query = db
    .from('tenant_invoices')
    .select(
      `
      id,
      title,
      status,
      created_at,
      due_date,
      amount_cents,
      amount_paid_cents,
      customers (
        customer_identities (
          first_name,
          last_name,
          full_name
        )
      ),
      tenant_invoice_payments (
        method,
        amount_cents
      )
    `,
    )
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (fromIso) query = query.gte('created_at', fromIso);
  if (toIso) query = query.lte('created_at', toIso);

  const { data, error } = await query;
  if (error || !data) {
    return { rows: [], summary: [{ label: 'Invoices', value: '0' }] };
  }

  const now = Date.now();
  let billedCents = 0;
  let paidCents = 0;

  const rows: InvoiceAuditRow[] = data.map((inv) => {
    const remaining = invoiceRemainingCents(inv);
    billedCents += inv.amount_cents;
    paidCents += inv.amount_paid_cents;

    const methods = new Set<string>();
    for (const p of inv.tenant_invoice_payments ?? []) {
      if (p.amount_cents > 0) {
        methods.add(manualPaymentMethodLabel(p.method));
      }
    }

    const ident = inv.customers?.customer_identities ?? null;
    return {
      invoiceId: inv.id,
      customerName: customerLabelFromIdentity(ident),
      title: inv.title,
      status: inv.status,
      createdAt: inv.created_at,
      dueDate: inv.due_date,
      amountCents: inv.amount_cents,
      paidCents: inv.amount_paid_cents,
      remainingCents: remaining,
      daysOutstanding: daysOutstanding(inv.due_date, now),
      paymentMethods: methods.size > 0 ? [...methods].join(', ') : '—',
      invoiceHref: `/billing/invoices/${inv.id}`,
      paymentAuditHref: '/billing/payment-audits',
    };
  });

  return {
    rows,
    summary: [
      { label: 'Invoices', value: String(rows.length) },
      { label: 'Billed', value: formatUsdFromCents(billedCents) },
      { label: 'Paid', value: formatUsdFromCents(paidCents) },
      { label: 'Outstanding', value: formatUsdFromCents(billedCents - paidCents) },
    ],
  };
}
