import Link from 'next/link';
import { ArrowDown, ArrowUpDown } from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import { formatInvoiceReference } from '@/lib/billing/formatInvoiceReference';
import {
  formatTransactionAmount,
  formatTransactionDate,
  transactionStatusLabel,
} from '@/lib/billing/transactionDisplay';
import { TransactionMethodCell } from './TransactionMethodCell';
import styles from './transactions.module.scss';

export type TransactionRow = {
  id: string;
  amount_cents: number;
  method: string;
  recorded_at: string;
  recorded_via: string;
  notes: string | null;
  tenant_invoices: {
    id: string;
    title: string;
    customerLabel: string;
  } | null;
};

export function TransactionsTable({ rows }: { rows: TransactionRow[] }) {
  return (
    <div className={styles.tablePanel}>
      <div className={styles.tableWrap}>
        <table className={styles.transactionsTable}>
          <colgroup>
            <col className={styles.colDate} />
            <col className={styles.colInvoice} />
            <col className={styles.colCustomer} />
            <col className={styles.colMethod} />
            <col className={styles.colAmount} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">
                <span className={styles.thInner}>
                  Date
                  <ArrowDown size={14} className={styles.thSortActive} aria-hidden />
                </span>
              </th>
              <th scope="col">
                <span className={styles.thInner}>
                  Invoice
                  <ArrowUpDown size={14} className={styles.thSortMuted} aria-hidden />
                </span>
              </th>
              <th scope="col">
                <span className={styles.thInner}>
                  Customer
                  <ArrowUpDown size={14} className={styles.thSortMuted} aria-hidden />
                </span>
              </th>
              <th scope="col">
                <span className={styles.thInner}>
                  Method
                  <ArrowUpDown size={14} className={styles.thSortMuted} aria-hidden />
                </span>
              </th>
              <th scope="col" className={styles.amountHeader}>
                <span className={styles.thInner}>
                  Amount
                  <ArrowUpDown size={14} className={styles.thSortMuted} aria-hidden />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const inv = row.tenant_invoices;

              return (
                <tr key={row.id}>
                  <td className={styles.dateCell}>{formatTransactionDate(row.recorded_at)}</td>
                  <td>
                    {inv ? (
                      <Link href={`/billing/invoices/${inv.id}`} className={styles.invoiceLink}>
                        {formatInvoiceReference(inv.id, inv.title)}
                      </Link>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                  <td className={styles.customerCell}>{inv?.customerLabel ?? '—'}</td>
                  <td>
                    <TransactionMethodCell
                      method={row.method}
                      recordedVia={row.recorded_via}
                      notes={row.notes}
                      paymentId={row.id}
                    />
                  </td>
                  <td className={styles.amountCell}>
                    <div className={styles.amountInner}>
                      <span className={styles.amountValue}>
                        {formatTransactionAmount(row.amount_cents)}
                      </span>
                      <StatusPill tone="success">{transactionStatusLabel()}</StatusPill>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
