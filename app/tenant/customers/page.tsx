import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  parseCustomerDirectoryQuery,
  parseCustomerDirectoryStatus,
  type CustomerDirectoryStatusParam,
} from '@/lib/tenant/customerDirectorySearch';
import {
  buildCustomerDirectorySearchParams,
  CUSTOMER_DIRECTORY_PAGE_SIZE,
  parseCustomerDirectoryPage,
} from '@/lib/tenant/customerDirectoryPaging';
import { fetchCustomerDirectoryPage } from '@/lib/tenant/customerDirectoryFetch';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';
import { primaryCustomerAddressLine } from '@/lib/tenant/customerListDisplay';
import { CustomerDirectoryPagination } from './CustomerDirectoryPagination';
import { CustomerDirectorySearchForm } from './CustomerDirectorySearchForm';
import { CustomersDirectoryCards } from './CustomersDirectoryCards';
import { CustomersDirectoryTable, type CustomerDirectoryRow } from './CustomersDirectoryTable';
import styles from './customers.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function toDirectoryRow(row: {
  id: string;
  status: string;
  customer_identities: {
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
    phone: string | null;
  } | null;
  tenant_customer_properties:
    | {
        address_line1: string | null;
        address_line2: string | null;
        city: string | null;
        state: string | null;
        postal_code: string | null;
        is_primary: boolean;
      }[]
    | null;
}): CustomerDirectoryRow {
  const identity = row.customer_identities;
  const name = identity ? formatCustomerDisplayName(identity) : 'Unnamed';

  return {
    id: row.id,
    status: row.status,
    name: name === 'Unnamed' ? 'Customer' : name,
    email: identity?.email?.trim() || null,
    phone: identity?.phone?.trim() || null,
    addressLine: primaryCustomerAddressLine(row.tenant_customer_properties),
  };
}

const TAB_LINKS: { key: CustomerDirectoryStatusParam; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
];

function tabCountFor(
  key: CustomerDirectoryStatusParam,
  counts: { all: number; active: number; inactive: number },
): number {
  if (key === 'active') return counts.active;
  if (key === 'inactive') return counts.inactive;
  return counts.all;
}

export default async function TenantCustomersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = parseCustomerDirectoryQuery(sp?.q);
  const statusFilter = parseCustomerDirectoryStatus(sp?.status);
  const requestedPage = parseCustomerDirectoryPage(firstParam(sp?.page));
  const filtersActive = q.length > 0 || statusFilter !== 'all';

  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/customers');

  const supabase = createTenantPortalDbClient();
  const result = await fetchCustomerDirectoryPage(supabase, {
    tenantId: membership.tenantId,
    q,
    statusFilter,
    page: requestedPage,
  });

  if (!result.ok) {
    return (
      <>
        <PageHeader
          title="Customers"
          titleHint="Residential and commercial accounts you serve under this workspace."
          actions={
            <Button
              variant="primary"
              as="a"
              href="/customers/new"
              iconLeft={<Plus size={18} aria-hidden />}
            >
              Add customer
            </Button>
          }
        />
        <div className={styles.errorPanel}>
          <p className={styles.empty} role="alert">
            {result.phase === 'search' ? 'Search error' : 'Could not load customers'} (
            {result.message}).
          </p>
        </div>
      </>
    );
  }

  const { rows, totalCount, statusCounts, page: safePage } = result;
  const totalPages = Math.max(1, Math.ceil(totalCount / CUSTOMER_DIRECTORY_PAGE_SIZE));
  const start = totalCount === 0 ? 0 : (safePage - 1) * CUSTOMER_DIRECTORY_PAGE_SIZE;
  const directoryRows = rows.map(toDirectoryRow);
  const pageRows = directoryRows;
  const showEmptyWorkspace = statusCounts.all === 0 && !filtersActive;

  return (
    <>
      <PageHeader
        title="Customers"
        titleHint="Search, filter, and open any account. Works whether you have a handful or thousands."
        actions={
          <Button
            variant="primary"
            as="a"
            href="/customers/new"
            iconLeft={<Plus size={18} aria-hidden />}
          >
            Add customer
          </Button>
        }
      />

      {showEmptyWorkspace ? (
        <EmptyState
          title="No customers yet"
          description="Add your first customer to start scheduling, quoting, and billing."
          action={
            <Button as={Link} href="/customers/new" variant="primary">
              Add customer
            </Button>
          }
        />
      ) : (
        <div className={styles.directoryPanel}>
          <div className={styles.panelToolbar}>
            <CustomerDirectorySearchForm q={q} status={statusFilter} />
            <nav className={styles.panelTabs} aria-label="Customer filters">
              {TAB_LINKS.map((tab) => (
                <Link
                  key={tab.key}
                  href={`/customers${buildCustomerDirectorySearchParams({ q, status: tab.key })}`}
                  className={styles.panelTab}
                  data-active={statusFilter === tab.key || undefined}
                  aria-current={statusFilter === tab.key ? 'page' : undefined}
                >
                  {tab.label}
                  <span className={styles.panelTabCount}>{tabCountFor(tab.key, statusCounts)}</span>
                </Link>
              ))}
            </nav>
          </div>

          {totalCount === 0 ? (
            <div className={styles.emptyPanel}>
              <p className={styles.empty}>
                No customers match your search.{' '}
                <Link
                  href={`/customers${buildCustomerDirectorySearchParams({ status: statusFilter })}`}
                  className={styles.inlineLink}
                >
                  Clear search
                </Link>
              </p>
            </div>
          ) : (
            <>
              <CustomersDirectoryTable rows={pageRows} />
              <CustomersDirectoryCards rows={pageRows} />
              <CustomerDirectoryPagination
                currentPage={safePage}
                totalPages={totalPages}
                totalCount={totalCount}
                fromIndex={start + 1}
                toIndex={start + pageRows.length}
                q={q}
                status={statusFilter}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}
