import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buildBillingListSearchParams } from '@/lib/billing/billingListPaging';
import styles from './billingListPagination.module.scss';

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

export function BillingListPagination({
  basePath,
  currentPage,
  totalPages,
  totalCount,
  fromIndex,
  toIndex,
  query,
  layout = 'embedded',
}: {
  basePath: string;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  fromIndex: number;
  toIndex: number;
  query?: string;
  /** `standalone` sits under a card list and stays hidden until a second page exists. */
  layout?: 'embedded' | 'standalone';
}) {
  if (totalCount === 0) return null;
  if (layout === 'standalone' && totalPages <= 1) return null;

  const pageHref = (page: number) =>
    `${basePath}${buildBillingListSearchParams({ page, q: query })}`;

  const prevHref = currentPage > 1 ? pageHref(currentPage - 1) : null;
  const nextHref = currentPage < totalPages ? pageHref(currentPage + 1) : null;

  return (
    <footer className={layout === 'standalone' ? styles.footerStandalone : styles.footer}>
      <p className={styles.summary}>
        Showing {fromIndex} to {toIndex} of {totalCount} results
      </p>
      <nav className={styles.pagination} aria-label="Pagination">
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
              href={pageHref(item)}
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
