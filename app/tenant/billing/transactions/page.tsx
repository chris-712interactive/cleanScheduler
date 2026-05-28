import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  BILLING_LIST_PAGE_SIZE,
  billingListRange,
  parseBillingListPage,
} from '@/lib/billing/billingListPaging';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';
import { canExportReports } from '@/lib/tenant/reportPermissions';
import { BillingListPagination } from '../BillingListPagination';
import { TransactionsTable, type TransactionRow } from './TransactionsTable';
import styles from './transactions.module.scss';

export const dynamic = 'force-dynamic';

type PaymentRow = {
  id: string;
  amount_cents: number;
  method: string;
  recorded_at: string;
  recorded_via: string;
  notes: string | null;
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

function customerLabel(row: PaymentRow): string {
  const ident = row.tenant_invoices?.customers?.customer_identities;
  if (!ident || !customerHasAnyNameParts(ident)) return '—';
  const name = formatCustomerDisplayName(ident);
  return name === 'Unnamed' ? '—' : name;
}

function toTransactionRow(row: PaymentRow): TransactionRow {
  const inv = row.tenant_invoices;

  return {
    id: row.id,
    amount_cents: row.amount_cents,
    method: row.method,
    recorded_at: row.recorded_at,
    recorded_via: row.recorded_via,
    notes: row.notes,
    tenant_invoices: inv
      ? {
          id: inv.id,
          title: inv.title,
          customerLabel: customerLabel(row),
        }
      : null,
  };
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function TenantBillingTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const page = parseBillingListPage(firstParam(sp.page));
  const { from, to } = billingListRange(page);

  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/transactions');
  const db = createTenantPortalDbClient();
  const canExport = canExportReports(membership.role);

  const {
    data: payments,
    error,
    count,
  } = await db
    .from('tenant_invoice_payments')
    .select(
      `
      id,
      amount_cents,
      method,
      recorded_at,
      recorded_via,
      notes,
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
      { count: 'exact' },
    )
    .eq('tenant_id', membership.tenantId)
    .order('recorded_at', { ascending: false })
    .range(from, to);

  const rows = (payments ?? []) as PaymentRow[];
  const tableRows = rows.map(toTransactionRow);
  const totalCount = count ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / BILLING_LIST_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  return (
    <>
      <PageHeader
        title="Customer payments"
        backHref="/billing"
        backLabel="Workspace billing"
        titleHint="All payments recorded on customer invoices — manual entries and Stripe Checkout."
        description="Payment ledger for your customers. For bank deposit matching, use Bank connection; for check/cash stages, use Payment audits."
        actions={
          canExport ? (
            <Button variant="secondary" as="a" href="/api/tenant/billing/export?type=transactions">
              Export CSV
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <div className={styles.errorPanel}>
          <p className={styles.muted}>{error.message}</p>
        </div>
      ) : !tableRows.length && currentPage === 1 ? (
        <EmptyState
          title="No transactions yet"
          description="Payments appear here when you record them on an invoice or when a customer pays online."
          action={
            <Link href="/billing/invoices" className={styles.backLink}>
              View invoices
            </Link>
          }
        />
      ) : (
        <TransactionsTable
          rows={tableRows}
          footer={
            <BillingListPagination
              basePath="/billing/transactions"
              currentPage={currentPage}
              totalPages={totalPages}
              totalCount={totalCount}
              fromIndex={totalCount === 0 ? 0 : from + 1}
              toIndex={from + tableRows.length}
            />
          }
        />
      )}
    </>
  );
}
