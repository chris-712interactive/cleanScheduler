import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buildPaymentAuditSearchParams } from '@/lib/billing/paymentAuditDateRange';
import styles from './paymentAudits.module.scss';

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

export function PaymentAuditPagination({
  currentPage,
  totalPages,
  totalCount,
  fromIndex,
  toIndex,
  queryBase,
}: {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  fromIndex: number;
  toIndex: number;
  queryBase: { filter?: string; from?: string; to?: string };
}) {
  if (totalCount === 0) return null;

  const prevHref =
    currentPage > 1
      ? `/billing/payment-audits${buildPaymentAuditSearchParams({ ...queryBase, page: currentPage - 1 })}`
      : null;
  const nextHref =
    currentPage < totalPages
      ? `/billing/payment-audits${buildPaymentAuditSearchParams({ ...queryBase, page: currentPage + 1 })}`
      : null;

  return (
    <footer className={styles.tableFooter}>
      <p className={styles.resultsSummary}>
        Showing {fromIndex} to {toIndex} of {totalCount} results
      </p>
      <nav className={styles.pagination} aria-label="Payment audits pagination">
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
              href={`/billing/payment-audits${buildPaymentAuditSearchParams({
                ...queryBase,
                page: item,
              })}`}
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
