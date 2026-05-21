import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { customerLabelFromIdentity } from '@/lib/reports/customerLabel';
import { fetchPaymentEventSummaries } from '@/lib/audit/recordTenantPaymentEvent';
import type { ReportSummaryLine } from '@/lib/reports/types';
import { formatUsdFromCents } from '@/lib/format/money';
import {
  manualPaymentAuditStage,
  type ManualPaymentAuditStage,
} from '@/lib/billing/manualPaymentAudit';

export interface FieldCheckRow {
  paymentId: string;
  recordedAt: string;
  customerName: string;
  invoiceId: string;
  invoiceTitle: string;
  amountCents: number;
  checkReference: string;
  stage: ManualPaymentAuditStage;
  chainOfCustody: string;
  paymentAuditHref: string;
  invoiceHref: string;
}

export interface FieldCheckResult {
  rows: FieldCheckRow[];
  summary: ReportSummaryLine[];
}

const STAGE_LABEL: Record<ManualPaymentAuditStage, string> = {
  awaiting_receipt: 'Awaiting receipt',
  awaiting_deposit: 'Awaiting deposit',
  complete: 'Complete',
};

export async function runFieldCheckReport(
  db: SupabaseClient<Database>,
  tenantId: string,
  fromIso: string | null,
  toIso: string | null,
): Promise<FieldCheckResult> {
  let query = db
    .from('tenant_invoice_payments')
    .select(
      `
      id,
      amount_cents,
      method,
      recorded_at,
      notes,
      received_at,
      deposited_at,
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
    .eq('method', 'check')
    .eq('recorded_via', 'manual')
    .order('recorded_at', { ascending: false });

  if (fromIso) query = query.gte('recorded_at', fromIso);
  if (toIso) query = query.lte('recorded_at', toIso);

  const { data, error } = await query.limit(500);
  if (error || !data) {
    return { rows: [], summary: [{ label: 'Check payments', value: '0' }] };
  }

  const rows: FieldCheckRow[] = [];
  let totalCents = 0;
  let openCount = 0;
  const paymentIds: string[] = [];

  for (const row of data) {
    if (row.amount_cents <= 0) continue;
    paymentIds.push(row.id);
  }

  const eventSummaries = await fetchPaymentEventSummaries(db, tenantId, paymentIds);

  for (const row of data) {
    if (row.amount_cents <= 0) continue;
    const stage = manualPaymentAuditStage(row);
    if (stage !== 'complete') openCount += 1;
    totalCents += row.amount_cents;

    const ident = row.tenant_invoices?.customers?.customer_identities ?? null;
    const invoiceId = row.tenant_invoices?.id ?? '';
    rows.push({
      paymentId: row.id,
      recordedAt: row.recorded_at,
      customerName: customerLabelFromIdentity(ident),
      invoiceId,
      invoiceTitle: row.tenant_invoices?.title ?? '—',
      amountCents: row.amount_cents,
      checkReference: row.notes?.trim() || '—',
      stage,
      chainOfCustody:
        eventSummaries.get(row.id) ??
        ([
          row.received_at ? `Received ${new Date(row.received_at).toLocaleDateString()}` : null,
          row.deposited_at ? `Deposited ${new Date(row.deposited_at).toLocaleDateString()}` : null,
        ]
          .filter(Boolean)
          .join('; ') ||
          '—'),
      paymentAuditHref: '/billing/payment-audits',
      invoiceHref: invoiceId ? `/billing/invoices/${invoiceId}` : '/billing/payment-audits',
    });
  }

  return {
    rows,
    summary: [
      { label: 'Check payments', value: String(rows.length) },
      { label: 'Total amount', value: formatUsdFromCents(totalCents) },
      { label: 'Not fully deposited', value: String(openCount) },
    ],
  };
}

export function fieldCheckStageLabel(stage: ManualPaymentAuditStage): string {
  return STAGE_LABEL[stage];
}
