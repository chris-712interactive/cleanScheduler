'use client';

import Link from 'next/link';
import { ArrowDown, ArrowUpDown } from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import { formatInvoiceReference } from '@/lib/billing/formatInvoiceReference';
import {
  formatPaymentAuditPosted,
  paymentAuditStageLabel,
  paymentAuditStageTone,
} from '@/lib/billing/paymentAuditDisplay';
import { manualPaymentAuditStage } from '@/lib/billing/manualPaymentAudit';
import { formatUsdFromCents } from '@/lib/format/money';
import { PaymentAuditMethodIcon } from './PaymentAuditMethodIcon';
import { PaymentAuditRowActions } from './PaymentAuditRowActions';
import styles from './paymentAudits.module.scss';

export type PaymentAuditRow = {
  id: string;
  amount_cents: number;
  method: string;
  recorded_at: string;
  notes: string | null;
  received_at: string | null;
  deposited_at: string | null;
  cleared_at: string | null;
  bounced_at: string | null;
  received_by_user_id: string | null;
  deposited_by_user_id: string | null;
  tenant_invoices: {
    id: string;
    title: string;
    customerId: string | null;
    customerLabel: string;
  } | null;
  bankMatch: {
    id: string;
    postedDate: string;
    name: string;
  } | null;
};

export function PaymentAuditTable({
  tenantSlug,
  rows,
}: {
  tenantSlug: string;
  rows: PaymentAuditRow[];
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.auditTable}>
        <colgroup>
          <col className={styles.colMethod} />
          <col className={styles.colPosted} />
          <col className={styles.colCustomer} />
          <col className={styles.colInvoice} />
          <col className={styles.colAmount} />
          <col className={styles.colStage} />
          <col className={styles.colActions} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className={styles.methodCol}>
              <span className={styles.methodColLabel}>Type</span>
            </th>
            <th scope="col">
              <span className={styles.thInner}>
                Posted
                <ArrowDown size={14} className={styles.thSortActive} aria-hidden />
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
                Invoice
                <ArrowUpDown size={14} className={styles.thSortMuted} aria-hidden />
              </span>
            </th>
            <th scope="col">
              <span className={styles.thInner}>
                Amount
                <ArrowUpDown size={14} className={styles.thSortMuted} aria-hidden />
              </span>
            </th>
            <th scope="col">
              <span className={styles.thInner}>
                Stage
                <ArrowUpDown size={14} className={styles.thSortMuted} aria-hidden />
              </span>
            </th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const inv = p.tenant_invoices;
            const stage = manualPaymentAuditStage(p);
            const invoiceHref = inv ? `/billing/invoices/${inv.id}` : null;

            return (
              <tr key={p.id}>
                <td className={styles.methodCol}>
                  <PaymentAuditMethodIcon method={p.method} />
                </td>
                <td className={styles.postedCell}>{formatPaymentAuditPosted(p.recorded_at)}</td>
                <td className={styles.customerCell}>
                  {inv?.customerId ? (
                    <Link href={`/customers/${inv.customerId}`} className={styles.customerLink}>
                      {inv.customerLabel}
                    </Link>
                  ) : (
                    (inv?.customerLabel ?? '—')
                  )}
                </td>
                <td>
                  {inv ? (
                    <div className={styles.invoiceCell}>
                      <a href={invoiceHref!} className={styles.invoiceLink}>
                        {formatInvoiceReference(inv.id, inv.title)}
                      </a>
                      {p.bankMatch ? (
                        <Link href="/billing/bank-connection" className={styles.bankMatchLink}>
                          Bank deposit · {p.bankMatch.postedDate} · {p.bankMatch.name}
                        </Link>
                      ) : null}
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={styles.amountCell}>{formatUsdFromCents(p.amount_cents)}</td>
                <td>
                  <StatusPill tone={paymentAuditStageTone(stage)}>
                    {paymentAuditStageLabel(stage)}
                  </StatusPill>
                </td>
                <td className={styles.actionsCell}>
                  <PaymentAuditRowActions
                    tenantSlug={tenantSlug}
                    paymentId={p.id}
                    stage={stage}
                    method={p.method}
                    invoiceHref={invoiceHref}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
