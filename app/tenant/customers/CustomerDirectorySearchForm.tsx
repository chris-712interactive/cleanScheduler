'use client';

import Link from 'next/link';
import { Search } from 'lucide-react';
import type { CustomerDirectoryStatusParam } from '@/lib/tenant/customerDirectorySearch';
import { buildCustomerDirectorySearchParams } from '@/lib/tenant/customerDirectoryPaging';
import styles from './customers.module.scss';

export function CustomerDirectorySearchForm({
  q,
  status,
}: {
  q: string;
  status: CustomerDirectoryStatusParam;
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
          placeholder="Name, email, phone, or address…"
          defaultValue={q}
          autoComplete="off"
        />
      </div>
      {q ? (
        <Link href={clearHref} className={styles.searchClear}>
          Clear
        </Link>
      ) : null}
    </form>
  );
}
