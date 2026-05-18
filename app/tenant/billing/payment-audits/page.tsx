import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';
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
} from '@/lib/billing/paymentAuditDateRange';
import { PaymentAuditDateRangeForm } from './PaymentAuditDateRangeForm';
import { PaymentAuditTable, type PaymentAuditRow } from './PaymentAuditTable';
import styles from '../billing.module.scss';

export const dynamic = 'force-dynamic';

type FilterKey = 'all' | 'awaiting_receipt' | 'awaiting_deposit' | 'complete';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parseFilter(raw: string | undefined): FilterKey {
  if (
    raw === 'awaiting_receipt' ||
    raw === 'awaiting_deposit' ||
    raw === 'complete' ||
    raw === 'all'
  ) {
    return raw;
  }
  return 'all';
}

const STAGE_SORT: Record<ReturnType<typeof manualPaymentAuditStage>, number> = {
  awaiting_receipt: 0,
  awaiting_deposit: 1,
  complete: 2,
};

type RawRow = {
  id: string;
  amount_cents: number;
  method: string;
  recorded_at: string;
  notes: string | null;
  received_at: string | null;
  deposited_at: string | null;
  received_by_user_id: string | null;
  deposited_by_user_id: string | null;
  tenant_invoices: {
    id: string;
    title: string;
    customers: {
      customer_identities: {
        first_name: string | null;
        last_name: string | null;
        full_name: string | null;
      } | null;
    } | null;
  } | null;
};

function customerLabelFromRow(row: RawRow): string {
  const ident = row.tenant_invoices?.customers?.customer_identities;
  if (!ident || !customerHasAnyNameParts(ident)) return '—';
  const name = formatCustomerDisplayName(ident);
  return name === 'Unnamed' ? '—' : name;
}

function toAuditRow(row: RawRow): PaymentAuditRow {
  const inv = row.tenant_invoices;
  return {
    id: row.id,
    amount_cents: row.amount_cents,
    method: row.method,
    recorded_at: row.recorded_at,
    notes: row.notes,
    received_at: row.received_at,
    deposited_at: row.deposited_at,
    received_by_user_id: row.received_by_user_id,
    deposited_by_user_id: row.deposited_by_user_id,
    tenant_invoices: inv
      ? {
          id: inv.id,
          title: inv.title,
          customerLabel: customerLabelFromRow(row),
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
  const dateRange = parsePaymentAuditDateRange(firstParam(sp.from), firstParam(sp.to));
  const rangeLabel = formatPaymentAuditDateRangeLabel(
    dateRange.fromInput,
    dateRange.toInput,
  );

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
      received_by_user_id,
      deposited_by_user_id,
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
  const sorted = [...rawRows].sort((a, b) => {
    const stageDiff =
      STAGE_SORT[manualPaymentAuditStage(a)] - STAGE_SORT[manualPaymentAuditStage(b)];
    if (stageDiff !== 0) return stageDiff;
    return new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime();
  });

  const rows = sorted
    .filter((r) => filter === 'all' || manualPaymentAuditStage(r) === filter)
    .map(toAuditRow);

  const awaitingReceipt = rawRows.filter((r) => !r.received_at).length;
  const awaitingDeposit = rawRows.filter((r) => r.received_at && !r.deposited_at).length;

  const staffIds = [
    ...new Set(
      rawRows
        .flatMap((r) => [r.received_by_user_id, r.deposited_by_user_id])
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const staffNames = new Map<string, string>();
  if (staffIds.length > 0) {
    const admin = createAdminClient();
    const { data: profiles } = await admin
      .from('user_profiles')
      .select('user_id, display_name')
      .in('user_id', staffIds);
    for (const p of profiles ?? []) {
      const name = p.display_name?.trim();
      if (name) staffNames.set(p.user_id, name);
    }
  }

  const queryBase = {
    from: dateRange.fromInput || undefined,
    to: dateRange.toInput || undefined,
  };

  const filterLinks: { key: FilterKey; label: string; count?: number }[] = [
    { key: 'all', label: 'All' },
    { key: 'awaiting_receipt', label: 'Awaiting receipt', count: awaitingReceipt },
    { key: 'awaiting_deposit', label: 'Awaiting deposit', count: awaitingDeposit },
    { key: 'complete', label: 'Complete' },
  ];

  const ledgerDescription = rangeLabel
    ? `${rows.length} shown · recorded ${rangeLabel}`
    : `${rows.length} shown · checks, cash, Zelle, ACH, and other non-Stripe entries`;

  return (
    <>
      <PageHeader
        title="Payment audits"
        description="Track check, cash, Zelle, and other offline payments — mark when received and when deposited."
      />

      <p className={styles.backLinkWrap}>
        <Link href="/billing" className={styles.backLink}>
          ← Workspace billing
        </Link>
      </p>

      <PaymentAuditDateRangeForm
        filter={filter}
        from={dateRange.fromInput}
        to={dateRange.toInput}
      />

      <nav className={styles.auditFilters} aria-label="Audit filters">
        {filterLinks.map((f) => (
          <Link
            key={f.key}
            href={`/billing/payment-audits${buildPaymentAuditSearchParams({
              ...queryBase,
              filter: f.key === 'all' ? undefined : f.key,
            })}`}
            className={styles.auditFilterLink}
            data-active={filter === f.key || undefined}
          >
            {f.label}
            {f.count !== undefined && f.count > 0 ? (
              <span className={styles.auditFilterCount}>{f.count}</span>
            ) : null}
          </Link>
        ))}
      </nav>

      {error ? (
        <Card title="Could not load payment audits">
          <p className={styles.muted}>{error.message}</p>
        </Card>
      ) : !rows.length ? (
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
            <Link href="/billing/invoices" className={styles.backLink}>
              View invoices
            </Link>
          }
        />
      ) : (
        <Card title="Offline payment ledger" description={ledgerDescription} padded={false}>
          <PaymentAuditTable
            tenantSlug={membership.tenantSlug}
            rows={rows}
            staffNames={staffNames}
          />
        </Card>
      )}
    </>
  );
}
