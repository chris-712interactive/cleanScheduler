import Link from 'next/link';
import { Search } from 'lucide-react';
import styles from './invoices.module.scss';

export function InvoiceListSearchForm({ q }: { q: string }) {
  return (
    <form method="get" className={styles.searchRow} role="search" aria-label="Search invoices">
      <label className={styles.searchLabel} htmlFor="invoice_list_q">
        Search invoices
      </label>
      <div className={styles.searchField}>
        <Search size={18} className={styles.searchIcon} aria-hidden />
        <input
          id="invoice_list_q"
          name="q"
          type="search"
          className={styles.searchInput}
          placeholder="Invoice number, customer, or address…"
          defaultValue={q}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
      {q ? (
        <Link href="/billing/invoices" className={styles.searchClear}>
          Clear
        </Link>
      ) : null}
    </form>
  );
}
