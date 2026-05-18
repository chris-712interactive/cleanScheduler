'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  manualPaymentAuditStage,
  manualPaymentMethodLabel,
} from '@/lib/billing/manualPaymentAudit';
import { formatUsdFromCents } from '@/lib/format/money';
import {
  markManualPaymentDeposited,
  markManualPaymentReceived,
} from './actions';
import styles from '../billing.module.scss';

export type PaymentAuditRow = {
  id: string;
  amount_cents: number;
  method: string;
  recorded_at: string;
  notes: string | null;
  received_at: string | null;
  deposited_at: string | null;
  received_by_user_id: string | null;
  deposited_by_user_id: string | null;
  tenant_invoices: {
    id: string;
    title: string;
    customerLabel: string;
  } | null;
};

function formatAuditWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatPostedDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }),
  };
}

export function PaymentAuditTable({
  tenantSlug,
  rows,
  staffNames,
}: {
  tenantSlug: string;
  rows: PaymentAuditRow[];
  staffNames: Map<string, string>;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.ledgerTable}>
        <thead>
          <tr>
            <th scope="col">Recorded</th>
            <th scope="col">Customer</th>
            <th scope="col">Invoice</th>
            <th scope="col">Method</th>
            <th scope="col" className={styles.amountCol}>
              Amount
            </th>
            <th scope="col">Received</th>
            <th scope="col">Deposited</th>
            <th scope="col">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const inv = p.tenant_invoices;
            const posted = formatPostedDate(p.recorded_at);
            const stage = manualPaymentAuditStage(p);
            const note = p.notes?.trim() ?? '';

            return (
              <tr key={p.id} data-audit-stage={stage}>
                <td className={styles.dateCell}>
                  <span className={styles.datePrimary}>{posted.date}</span>
                  <span className={styles.dateSecondary}>{posted.time}</span>
                </td>
                <td className={styles.customerCell}>{inv?.customerLabel ?? '—'}</td>
                <td>
                  {inv ? (
                    <Link href={`/billing/invoices/${inv.id}`} className={styles.rowLink}>
                      {inv.title || 'Invoice'}
                    </Link>
                  ) : (
                    <span className={styles.muted}>—</span>
                  )}
                </td>
                <td className={styles.methodCell}>{manualPaymentMethodLabel(p.method)}</td>
                <td className={styles.amountCol}>{formatUsdFromCents(p.amount_cents)}</td>
                <td className={styles.auditCell}>
                  {p.received_at ? (
                    <div className={styles.auditDone}>
                      <StatusPill tone="success">Received</StatusPill>
                      <span className={styles.auditMeta}>
                        {formatAuditWhen(p.received_at)}
                        {p.received_by_user_id && staffNames.get(p.received_by_user_id)
                          ? ` · ${staffNames.get(p.received_by_user_id)}`
                          : null}
                      </span>
                    </div>
                  ) : (
                    <form action={markManualPaymentReceived} className={styles.auditForm}>
                      <input type="hidden" name="tenant_slug" value={tenantSlug} />
                      <input type="hidden" name="payment_id" value={p.id} />
                      <Button type="submit" variant="secondary" size="sm">
                        Mark received
                      </Button>
                    </form>
                  )}
                </td>
                <td className={styles.auditCell}>
                  {p.deposited_at ? (
                    <div className={styles.auditDone}>
                      <StatusPill tone="brand">Deposited</StatusPill>
                      <span className={styles.auditMeta}>
                        {formatAuditWhen(p.deposited_at)}
                        {p.deposited_by_user_id && staffNames.get(p.deposited_by_user_id)
                          ? ` · ${staffNames.get(p.deposited_by_user_id)}`
                          : null}
                      </span>
                    </div>
                  ) : p.received_at ? (
                    <form action={markManualPaymentDeposited} className={styles.auditForm}>
                      <input type="hidden" name="tenant_slug" value={tenantSlug} />
                      <input type="hidden" name="payment_id" value={p.id} />
                      <Button type="submit" variant="primary" size="sm">
                        Mark deposited
                      </Button>
                    </form>
                  ) : (
                    <span className={styles.muted}>—</span>
                  )}
                </td>
                <td className={styles.noteCell} title={note || undefined}>
                  {note || <span className={styles.muted}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
