import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  BILLING_LIST_PAGE_SIZE,
  billingListRange,
  parseBillingListPage,
} from '@/lib/billing/billingListPaging';
import {
  formatInvoiceListDate,
  formatInvoiceListHeading,
  invoiceListStatusLabel,
  invoiceListStatusTone,
} from '@/lib/billing/invoiceListDisplay';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';
import { canExportReports } from '@/lib/tenant/reportPermissions';
import { formatUsdFromCents } from '@/lib/format/money';
import { BillingListPagination } from '../BillingListPagination';
import styles from './invoices.module.scss';

export const dynamic = 'force-dynamic';

type InvoiceRow = {
  id: string;
  title: string;
  status: string;
  amount_cents: number;
  created_at: string;
  customers: {
    customer_identities: {
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
    } | null;
  } | null;
};

function customerLabelFromRow(row: InvoiceRow): string {
  const ident = row.customers?.customer_identities;
  if (!ident || !customerHasAnyNameParts(ident)) return '—';
  const name = formatCustomerDisplayName(ident);
  return name === 'Unnamed' ? '—' : name;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function TenantCustomerInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const page = parseBillingListPage(firstParam(sp.page));
  const { from, to } = billingListRange(page);

  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/invoices');
  const db = createTenantPortalDbClient();
  const canExport = canExportReports(membership.role);

  const { data: invoices, error, count } = await db
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
      { count: 'exact' },
    )
    .eq('tenant_id', membership.tenantId)
    .order('created_at', { ascending: false })
    .range(from, to);

  const rows = (invoices ?? []) as InvoiceRow[];
  const totalCount = count ?? rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / BILLING_LIST_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  return (
    <>
      <PageHeader
        title="Customer invoices"
        backHref="/billing"
        backLabel="Workspace billing"
        titleHint="Bill your customers for completed work. Payments update balances automatically."
        actions={
          <>
            {canExport ? (
              <Button variant="secondary" as="a" href="/api/tenant/billing/export?type=invoices">
                Export CSV
              </Button>
            ) : null}
            <Button variant="primary" as="a" href="/billing/invoices/new">
              New invoice
            </Button>
          </>
        }
      />

      {error ? (
        <div className={styles.errorPanel}>
          <p className={styles.muted}>{error.message}</p>
        </div>
      ) : !rows.length && currentPage === 1 ? (
        <EmptyState
          title="No customer invoices yet"
          description="Create an invoice linked to a customer in your directory. Card checkout via Stripe Connect comes later."
          action={
            <Button variant="primary" as="a" href="/billing/invoices/new">
              Create invoice
            </Button>
          }
        />
      ) : (
        <div className={styles.tablePanel}>
          <ul className={styles.list}>
            {rows.map((inv) => (
              <li key={inv.id}>
                <Link href={`/billing/invoices/${inv.id}`} className={styles.cardLink}>
                  <article className={styles.card}>
                    <div className={styles.cardLeft}>
                      <p className={styles.invoiceHeading}>
                        {formatInvoiceListHeading(inv.id, inv.title)}
                      </p>
                      <p className={styles.customerName}>{customerLabelFromRow(inv)}</p>
                      <p className={styles.invoiceDate}>{formatInvoiceListDate(inv.created_at)}</p>
                    </div>
                    <div className={styles.cardRight}>
                      <span className={styles.amount}>{formatUsdFromCents(inv.amount_cents)}</span>
                      <StatusPill tone={invoiceListStatusTone(inv.status)}>
                        {invoiceListStatusLabel(inv.status)}
                      </StatusPill>
                    </div>
                  </article>
                </Link>
              </li>
            ))}
          </ul>
          <BillingListPagination
            basePath="/billing/invoices"
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            fromIndex={totalCount === 0 ? 0 : from + 1}
            toIndex={from + rows.length}
          />
        </div>
      )}
    </>
  );
}
