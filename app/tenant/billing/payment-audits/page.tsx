import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';
import {
  MANUAL_AUDIT_PAYMENT_METHODS,
  manualPaymentAuditStage,
} from '@/lib/billing/manualPaymentAudit';
import {
  buildPaymentAuditSearchParams,
  formatPaymentAuditDateRangeLabel,
  parsePaymentAuditDateRange,
  PAYMENT_AUDIT_PAGE_SIZE,
} from '@/lib/billing/paymentAuditDateRange';
import { PaymentAuditDateRangeForm } from './PaymentAuditDateRangeForm';
import { PaymentAuditPagination } from './PaymentAuditPagination';
import { PaymentAuditTable, type PaymentAuditRow } from './PaymentAuditTable';
import styles from './paymentAudits.module.scss';

export const dynamic = 'force-dynamic';

type FilterKey =
  'all' | 'awaiting_receipt' | 'awaiting_deposit' | 'awaiting_clearance' | 'bounced' | 'complete';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parseFilter(raw: string | undefined): FilterKey {
  if (
    raw === 'awaiting_receipt' ||
    raw === 'awaiting_deposit' ||
    raw === 'awaiting_clearance' ||
    raw === 'bounced' ||
    raw === 'complete' ||
    raw === 'all'
  ) {
    return raw;
  }
  return 'all';
}

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

type RawRow = {
  id: string;
  amount_cents: number;
  method: string;
  recorded_at: string;
  notes: string | null;
  received_at: string | null;
  deposited_at: string | null;
  cleared_at: string | null;
  bounced_at: string | null;
  received_by_user_id: string | null;
  deposited_by_user_id: string | null;
  tenant_invoices: {
    id: string;
    title: string;
    customer_id: string | null;
    customers: {
      customer_identities: {
        first_name: string | null;
        last_name: string | null;
        full_name: string | null;
      } | null;
    } | null;
  } | null;
};

type BankMatchRow = {
  id: string;
  matched_payment_id: string | null;
  posted_date: string;
  name: string;
  merchant_name: string | null;
};

function customerLabelFromRow(row: RawRow): string {
  const ident = row.tenant_invoices?.customers?.customer_identities;
  if (!ident || !customerHasAnyNameParts(ident)) return '—';
  const name = formatCustomerDisplayName(ident);
  return name === 'Unnamed' ? '—' : name;
}

function toAuditRow(row: RawRow, bankMatch?: BankMatchRow): PaymentAuditRow {
  const inv = row.tenant_invoices;
  return {
    id: row.id,
    amount_cents: row.amount_cents,
    method: row.method,
    recorded_at: row.recorded_at,
    notes: row.notes,
    received_at: row.received_at,
    deposited_at: row.deposited_at,
    cleared_at: row.cleared_at,
    bounced_at: row.bounced_at,
    received_by_user_id: row.received_by_user_id,
    deposited_by_user_id: row.deposited_by_user_id,
    tenant_invoices: inv
      ? {
          id: inv.id,
          title: inv.title,
          customerId: inv.customer_id,
          customerLabel: customerLabelFromRow(row),
        }
      : null,
    bankMatch: bankMatch
      ? {
          id: bankMatch.id,
          postedDate: bankMatch.posted_date,
          name: bankMatch.merchant_name?.trim() || bankMatch.name,
        }
      : null,
  };
}

export default async function TenantPaymentAuditsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filter = parseFilter(firstParam(sp.filter));
  const page = parsePage(firstParam(sp.page));
  const dateRange = parsePaymentAuditDateRange(firstParam(sp.from), firstParam(sp.to));
  const rangeLabel = formatPaymentAuditDateRangeLabel(dateRange.fromInput, dateRange.toInput);

  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/payment-audits');
  const db = createTenantPortalDbClient();

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
      cleared_at,
      bounced_at,
      received_by_user_id,
      deposited_by_user_id,
      tenant_invoices (
        id,
        title,
        customer_id,
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
    .eq('tenant_id', membership.tenantId)
    .eq('recorded_via', 'manual')
    .in('method', MANUAL_AUDIT_PAYMENT_METHODS);

  if (dateRange.fromIso) {
    query = query.gte('recorded_at', dateRange.fromIso);
  }
  if (dateRange.toIso) {
    query = query.lte('recorded_at', dateRange.toIso);
  }

  const { data: payments, error } = await query
    .order('recorded_at', { ascending: false })
    .limit(500);

  const rawRows = (payments ?? []) as RawRow[];
  const filteredRows = rawRows
    .filter((r) => filter === 'all' || manualPaymentAuditStage(r) === filter)
    .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());

  const totalCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAYMENT_AUDIT_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAYMENT_AUDIT_PAGE_SIZE;
  const pageRawRows = filteredRows.slice(start, start + PAYMENT_AUDIT_PAGE_SIZE);
  const paymentIds = pageRawRows.map((row) => row.id);

  const bankMatchByPaymentId = new Map<string, BankMatchRow>();
  if (paymentIds.length > 0) {
    const { data: bankRows } = await db
      .from('bank_transactions')
      .select('id, matched_payment_id, posted_date, name, merchant_name')
      .eq('tenant_id', membership.tenantId)
      .in('matched_payment_id', paymentIds);

    for (const row of (bankRows ?? []) as BankMatchRow[]) {
      if (row.matched_payment_id) {
        bankMatchByPaymentId.set(row.matched_payment_id, row);
      }
    }
  }

  const pageRows = pageRawRows.map((row) => toAuditRow(row, bankMatchByPaymentId.get(row.id)));

  const queryBase = {
    from: dateRange.fromInput || undefined,
    to: dateRange.toInput || undefined,
    filter: filter === 'all' ? undefined : filter,
  };

  const filterLinks: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'awaiting_receipt', label: 'Awaiting receipt' },
    { key: 'awaiting_deposit', label: 'Awaiting deposit' },
    { key: 'awaiting_clearance', label: 'Awaiting clearance' },
    { key: 'bounced', label: 'Bounced' },
    { key: 'complete', label: 'Complete' },
  ];

  return (
    <>
      <PageHeader
        title="Payment audits"
        backHref="/billing"
        backLabel="Workspace billing"
        titleHint="Track check, cash, Zelle, and other offline payments — mark when received and when deposited."
      />

      <PaymentAuditDateRangeForm
        filter={filter}
        from={dateRange.fromInput}
        to={dateRange.toInput}
      />

      <nav className={styles.filters} aria-label="Audit status">
        {filterLinks.map((f) => (
          <Link
            key={f.key}
            href={`/billing/payment-audits${buildPaymentAuditSearchParams({
              ...queryBase,
              filter: f.key === 'all' ? undefined : f.key,
            })}`}
            className={styles.filterTab}
            data-active={filter === f.key || undefined}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <div className={styles.errorPanel}>
          <p className={styles.muted}>{error.message}</p>
        </div>
      ) : !pageRows.length ? (
        <EmptyState
          title={
            rangeLabel
              ? 'No payments in this date range'
              : filter === 'all'
                ? 'No offline payments to audit'
                : 'Nothing in this filter'
          }
          description={
            rangeLabel
              ? 'Try a wider date range, clear the dates, or choose another status filter.'
              : filter === 'all'
                ? 'When you record cash, check, Zelle, or ACH on an invoice, entries appear here for receipt and deposit tracking.'
                : 'Try another filter or record a manual payment on an invoice.'
          }
          action={
            <Link href="/billing/invoices" className={styles.clearDates}>
              View invoices
            </Link>
          }
        />
      ) : (
        <div className={styles.tablePanel}>
          <PaymentAuditTable tenantSlug={membership.tenantSlug} rows={pageRows} />
          <PaymentAuditPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            fromIndex={start + 1}
            toIndex={start + pageRows.length}
            queryBase={queryBase}
          />
        </div>
      )}
    </>
  );
}
