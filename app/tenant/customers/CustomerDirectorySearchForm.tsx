'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import type { CustomerDirectoryStatusParam } from '@/lib/tenant/customerDirectorySearch';
import { buildCustomerDirectorySearchParams } from '@/lib/tenant/customerDirectoryPaging';
import styles from './customers.module.scss';

export function CustomerDirectorySearchForm({
  q,
  status,
  zone,
  zones,
}: {
  q: string;
  status: CustomerDirectoryStatusParam;
  zone: string | null;
  zones: Array<{ id: string; name: string }>;
}) {
  const clearHref = `/customers${buildCustomerDirectorySearchParams({ status })}`;

  return (
    <form method="get" className={styles.searchRow} aria-label="Search customers" role="search">
      {status !== 'all' ? <input type="hidden" name="status" value={status} /> : null}
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
          placeholder="Name, email, phone, address, or zone…"
          defaultValue={q}
          autoComplete="off"
        />
      </div>
      {zones.length > 0 ? (
        <label className={styles.zoneFilter}>
          <span className={styles.zoneFilterLabel}>Zone</span>
          <select
            name="zone"
            className={styles.zoneFilterSelect}
            defaultValue={zone ?? ''}
            aria-label="Filter by service zone"
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
          >
            <option value="">All zones</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {q || zone ? (
        <Link href={clearHref} className={styles.searchClear}>
          Clear
        </Link>
      ) : null}
    </form>
  );
}
