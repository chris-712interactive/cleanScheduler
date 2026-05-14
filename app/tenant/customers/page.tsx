import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { CustomerListEmbedRow } from '@/lib/tenant/customerEmbedTypes';
import {
  customerIdentitySearchOrClause,
  parseCustomerDirectoryQuery,
  parseCustomerDirectoryStatus,
} from '@/lib/tenant/customerDirectorySearch';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';
import styles from './customers.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function TenantCustomersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = parseCustomerDirectoryQuery(sp?.q);
  const statusFilter = parseCustomerDirectoryStatus(sp?.status);
  const filtersActive = q.length > 0 || statusFilter !== 'all';

  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/customers');

  const supabase = createTenantPortalDbClient();

  let identityIds: string[] | null = null;
  if (q.length > 0) {
    const { data: identRows, error: identError } = await supabase
      .from('customer_identities')
      .select('id')
      .or(customerIdentitySearchOrClause(q));

    if (identError) {
      return (
        <>
          <PageHeader
            title="Customers"
            description="Residential and commercial accounts you serve under this workspace."
            actions={
              <Button variant="primary" as="a" href="/customers/new">
                Add customer
              </Button>
            }
          />
          <Stack gap={6}>
            <Card title="Directory" description="Could not run search.">
              <p className={styles.empty} role="alert">
                Search error ({identError.message}).
              </p>
            </Card>
          </Stack>
        </>
      );
    }

    identityIds = identRows?.map((r) => r.id) ?? [];
  }

  let listError: { message: string } | null = null;
  let customers: CustomerListEmbedRow[] = [];

  if (identityIds !== null && identityIds.length === 0) {
    customers = [];
  } else {
    let custQuery = supabase
      .from('customers')
      .select(
        `
      id,
      status,
      created_at,
      customer_identities (
        email,
        first_name,
        last_name,
        full_name,
        phone
      )
    `,
      )
      .eq('tenant_id', membership.tenantId)
      .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
      custQuery = custQuery.eq('status', statusFilter);
    }
    if (identityIds !== null && identityIds.length > 0) {
      custQuery = custQuery.in('customer_identity_id', identityIds);
    }

    const { data: rows, error } = await custQuery.overrideTypes<CustomerListEmbedRow[], { merge: false }>();
    listError = error ? { message: error.message } : null;
    customers = rows ?? [];
  }

  const directoryDescription = filtersActive
    ? `${customers.length} match${customers.length === 1 ? '' : 'es'} · Filters on`
    : `${customers.length} customer${customers.length === 1 ? '' : 's'}`;

  return (
    <>
      <PageHeader
        title="Customers"
        description="Residential and commercial accounts you serve under this workspace."
        actions={
          <Button variant="primary" as="a" href="/customers/new">
            Add customer
          </Button>
        }
      />

      <Stack gap={6}>
        <Card title="Directory" description={directoryDescription}>
          <form method="get" className={styles.directoryToolbar} aria-label="Search and filter customers">
            <div className={styles.directoryToolbarRow}>
              <div className={styles.directorySearch}>
                <label className={styles.label} htmlFor="customer_directory_q">
                  Search
                </label>
                <input
                  id="customer_directory_q"
                  name="q"
                  type="search"
                  className={styles.input}
                  placeholder="First or last name, email, or phone"
                  defaultValue={q}
                  autoComplete="off"
                />
              </div>
              <div className={styles.directoryFilter}>
                <label className={styles.label} htmlFor="customer_directory_status">
                  Status
                </label>
                <select
                  id="customer_directory_status"
                  name="status"
                  className={styles.input}
                  defaultValue={statusFilter}
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className={styles.directoryToolbarActions}>
                <button type="submit" className={styles.submit}>
                  Apply
                </button>
                {filtersActive ? (
                  <Link href="/customers" className={styles.directoryClearLink}>
                    Clear filters
                  </Link>
                ) : null}
              </div>
            </div>
            <p className={styles.directoryFilterHint}>
              Press Apply after changing search or status. Results match any of first name, last name, full name, email, or phone.
            </p>
          </form>

          {listError ? (
            <p className={styles.empty} role="alert">
              Could not load customers ({listError.message}).
            </p>
          ) : customers.length === 0 && !filtersActive ? (
            <p className={styles.empty}>
              No customers yet.{' '}
              <Link href="/customers/new" className={styles.inlineLink}>
                Add your first customer
              </Link>
            </p>
          ) : customers.length === 0 ? (
            <p className={styles.empty}>
              No customers match these filters.{' '}
              <Link href="/customers" className={styles.inlineLink}>
                Clear filters
              </Link>
            </p>
          ) : (
            <ul className={styles.list}>
              {customers.map((c) => {
                const identity = c.customer_identities;
                const name = identity ? formatCustomerDisplayName(identity) : 'Unnamed';
                const email = identity?.email ?? '—';
                const phone = identity?.phone ?? '—';
                return (
                  <li key={c.id} className={styles.row}>
                    <div>
                      <Link href={`/customers/${c.id}`} className={`${styles.name} ${styles.detailLink}`}>
                        {name}
                      </Link>
                      <div className={styles.sub}>
                        {email} · {phone}
                      </div>
                    </div>
                    <span className={styles.status}>{c.status}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </Stack>
    </>
  );
}
