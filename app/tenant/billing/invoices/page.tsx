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
  buildInvoiceListOrFilter,
  findCustomerIdsForInvoiceSearch,
  parseInvoiceListQuery,
} from '@/lib/billing/invoiceListSearch';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';
import { canExportReports } from '@/lib/tenant/reportPermissions';
import { loadInvoicePropertyLabels } from '@/lib/billing/invoiceProperty';
import { formatUsdFromCents } from '@/lib/format/money';
import { BillingListPagination } from '../BillingListPagination';
import { InvoiceListSearchForm } from './InvoiceListSearchForm';
import styles from './invoices.module.scss';

export const dynamic = 'force-dynamic';

type InvoiceRow = {
  id: string;
  title: string;
  status: string;
  amount_cents: number;
  created_at: string;
  property_id: string | null;
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
  const query = parseInvoiceListQuery(firstParam(sp.q));
  const { from, to } = billingListRange(page);

  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/invoices');
  const db = createTenantPortalDbClient();
  const canExport = canExportReports(membership.role);

  let searchError: string | null = null;
  let orFilter: string | null = null;
  if (query) {
    const found = await findCustomerIdsForInvoiceSearch(db, membership.tenantId, query);
    searchError = found.error;
    if (!searchError) {
      orFilter = buildInvoiceListOrFilter({
        query,
        customerIds: found.customerIds,
        propertyIds: found.propertyIds,
      });
    }
  }

  let rows: InvoiceRow[] = [];
  let totalCount = 0;
  let listError = searchError;

  if (!searchError) {
    let invoiceRequest = db
      .from('tenant_invoices')
      .select(
        `
      id,
      title,
      status,
      amount_cents,
      created_at,
      property_id,
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
      .order('created_at', { ascending: false });
    if (orFilter) invoiceRequest = invoiceRequest.or(orFilter);

    const { data: invoices, error, count } = await invoiceRequest.range(from, to);
    rows = (invoices ?? []) as InvoiceRow[];
    totalCount = count ?? rows.length;
    listError = error?.message ?? null;
  }

  const propertyLabels = listError
    ? new Map<string, string>()
    : await loadInvoicePropertyLabels(
        db,
        membership.tenantId,
        rows.map((row) => row.property_id),
      );
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

      <InvoiceListSearchForm q={query} />

      {listError ? (
        <div className={styles.errorPanel}>
          <p className={styles.muted}>{listError}</p>
        </div>
      ) : !rows.length && currentPage === 1 && !query ? (
        <EmptyState
          title="No customer invoices yet"
          description="Create an invoice linked to a customer in your directory. Card checkout via Stripe Connect comes later."
          action={
            <Button variant="primary" as="a" href="/billing/invoices/new">
              Create invoice
            </Button>
          }
        />
      ) : !rows.length ? (
        <EmptyState
          title="No invoices match your search"
          description="Try an invoice number, customer name, or property address."
          action={
            <Button variant="secondary" as="a" href="/billing/invoices">
              Clear search
            </Button>
          }
        />
      ) : (
        <div className={styles.results}>
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
                      {inv.property_id && propertyLabels.get(inv.property_id) ? (
                        <p className={styles.propertyAddress}>
                          {propertyLabels.get(inv.property_id)}
                        </p>
                      ) : null}
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
            layout="standalone"
            basePath="/billing/invoices"
            query={query}
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
