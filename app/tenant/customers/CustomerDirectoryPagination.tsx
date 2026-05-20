import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CustomerDirectoryStatusParam } from '@/lib/tenant/customerDirectorySearch';
import { buildCustomerDirectorySearchParams } from '@/lib/tenant/customerDirectoryPaging';
import styles from './customers.module.scss';

function pageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 3) {
    return [1, 2, 3, 'ellipsis', total];
  }
  if (current >= total - 2) {
    return [1, 'ellipsis', total - 2, total - 1, total];
  }
  return [1, 'ellipsis', current, 'ellipsis', total];
}

export function CustomerDirectoryPagination({
  currentPage,
  totalPages,
  totalCount,
  fromIndex,
  toIndex,
  q,
  status,
}: {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  fromIndex: number;
  toIndex: number;
  q: string;
  status: CustomerDirectoryStatusParam;
}) {
  if (totalCount === 0) return null;

  const base = { q, status };
  const prevHref =
    currentPage > 1
      ? `/customers${buildCustomerDirectorySearchParams({ ...base, page: currentPage - 1 })}`
      : null;
  const nextHref =
    currentPage < totalPages
      ? `/customers${buildCustomerDirectorySearchParams({ ...base, page: currentPage + 1 })}`
      : null;

  return (
    <footer className={styles.directoryFooter}>
      <p className={styles.resultsSummary}>
        Showing {fromIndex} to {toIndex} of {totalCount} customer{totalCount === 1 ? '' : 's'}
      </p>
      <nav className={styles.pagination} aria-label="Customer directory pagination">
        {prevHref ? (
          <Link href={prevHref} className={styles.pageNav} aria-label="Previous page">
            <ChevronLeft size={16} aria-hidden />
          </Link>
        ) : (
          <span className={styles.pageNav} aria-disabled="true">
            <ChevronLeft size={16} aria-hidden />
          </span>
        )}
        {pageNumbers(currentPage, totalPages).map((item, idx) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${idx}`} className={styles.pageEllipsis} aria-hidden>
              …
            </span>
          ) : (
            <Link
              key={item}
              href={`/customers${buildCustomerDirectorySearchParams({ ...base, page: item })}`}
              className={styles.pageNum}
              data-active={item === currentPage || undefined}
              aria-current={item === currentPage ? 'page' : undefined}
            >
              {item}
            </Link>
          ),
        )}
        {nextHref ? (
          <Link href={nextHref} className={styles.pageNav} aria-label="Next page">
            <ChevronRight size={16} aria-hidden />
          </Link>
        ) : (
          <span className={styles.pageNav} aria-disabled="true">
            <ChevronRight size={16} aria-hidden />
          </span>
        )}
      </nav>
    </footer>
  );
}
