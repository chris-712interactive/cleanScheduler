import Link from 'next/link';
import { Search, Plus } from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  buildCustomerDirectorySearchOrFilter,
  customerDirectoryStatusFromQuery,
  customerIdentitySearchOrClause,
  customerPropertySearchOrClause,
  parseCustomerDirectoryQuery,
  parseCustomerDirectoryStatus,
  type CustomerDirectoryStatusParam,
} from '@/lib/tenant/customerDirectorySearch';
import {
  buildCustomerDirectorySearchParams,
  CUSTOMER_DIRECTORY_PAGE_SIZE,
  parseCustomerDirectoryPage,
} from '@/lib/tenant/customerDirectoryPaging';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';
import { primaryCustomerAddressLine } from '@/lib/tenant/customerListDisplay';
import { CustomerDirectoryPagination } from './CustomerDirectoryPagination';
import { CustomersDirectoryTable, type CustomerDirectoryRow } from './CustomersDirectoryTable';
import styles from './customers.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}

type CustomerListRow = {
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
};

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function toDirectoryRow(row: CustomerListRow): CustomerDirectoryRow {
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

export default async function TenantCustomersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = parseCustomerDirectoryQuery(sp?.q);
  const statusFilter = parseCustomerDirectoryStatus(sp?.status);
  const currentPage = parseCustomerDirectoryPage(firstParam(sp?.page));
  const filtersActive = q.length > 0 || statusFilter !== 'all';

  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/customers');

  const supabase = createTenantPortalDbClient();

  let searchOrFilter: string | null = null;
  if (q.length > 0) {
    const statusFromQuery = customerDirectoryStatusFromQuery(q);

    const [identResult, propertyResult, statusResult] = await Promise.all([
      supabase.from('customer_identities').select('id').or(customerIdentitySearchOrClause(q)),
      supabase
        .from('tenant_customer_properties')
        .select('customer_id')
        .eq('tenant_id', membership.tenantId)
        .or(customerPropertySearchOrClause(q)),
      statusFromQuery
        ? supabase
            .from('customers')
            .select('id')
            .eq('tenant_id', membership.tenantId)
            .eq('status', statusFromQuery)
        : Promise.resolve({ data: null, error: null }),
    ]);

    const searchError = identResult.error ?? propertyResult.error ?? statusResult.error ?? null;

    if (searchError) {
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
              Search error ({searchError.message}).
            </p>
          </div>
        </>
      );
    }

    const identityIds = identResult.data?.map((row) => row.id) ?? [];
    const customerIds = [
      ...new Set([
        ...(propertyResult.data?.map((row) => row.customer_id) ?? []),
        ...(statusResult.data?.map((row) => row.id) ?? []),
      ]),
    ];

    searchOrFilter = buildCustomerDirectorySearchOrFilter({ identityIds, customerIds });
  }

  let listError: { message: string } | null = null;
  let customers: CustomerListRow[] = [];

  if (q.length > 0 && searchOrFilter === null) {
    customers = [];
  } else {
    let custQuery = supabase
      .from('customers')
      .select(
        `
      id,
      status,
      customer_identities (
        email,
        first_name,
        last_name,
        full_name,
        phone
      ),
      tenant_customer_properties (
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        is_primary
      )
    `,
      )
      .eq('tenant_id', membership.tenantId)
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      custQuery = custQuery.eq('status', statusFilter);
    }
    if (searchOrFilter) {
      custQuery = custQuery.or(searchOrFilter);
    }

    const { data: rows, error } = await custQuery.overrideTypes<
      CustomerListRow[],
      { merge: false }
    >();
    listError = error ? { message: error.message } : null;
    customers = rows ?? [];
  }

  const directoryRows = customers.map(toDirectoryRow);
  const totalCount = directoryRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / CUSTOMER_DIRECTORY_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * CUSTOMER_DIRECTORY_PAGE_SIZE;
  const pageRows = directoryRows.slice(start, start + CUSTOMER_DIRECTORY_PAGE_SIZE);

  const tabLinks: { key: CustomerDirectoryStatusParam; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'inactive', label: 'Inactive' },
  ];

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

      <nav className={styles.directoryTabs} aria-label="Customer filters">
        {tabLinks.map((tab) => (
          <Link
            key={tab.key}
            href={`/customers${buildCustomerDirectorySearchParams({ q, status: tab.key })}`}
            className={styles.directoryTab}
            data-active={statusFilter === tab.key || undefined}
            aria-current={statusFilter === tab.key ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {listError ? (
        <div className={styles.errorPanel}>
          <p className={styles.empty} role="alert">
            Could not load customers ({listError.message}).
          </p>
        </div>
      ) : totalCount === 0 && !filtersActive ? (
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
          <form
            method="get"
            className={styles.searchForm}
            aria-label="Search customers"
            role="search"
          >
            {statusFilter !== 'all' ? (
              <input type="hidden" name="status" value={statusFilter} />
            ) : null}
            <label className={styles.searchLabel} htmlFor="customer_directory_q">
              Search customers
            </label>
            <div className={styles.searchField}>
              <Search size={18} className={styles.searchIcon} aria-hidden />
              <input
                id="customer_directory_q"
                name="q"
                type="search"
                className={styles.searchInput}
                placeholder="Search customers..."
                defaultValue={q}
                autoComplete="off"
              />
            </div>
          </form>

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
