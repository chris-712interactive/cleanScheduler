import Link from 'next/link';
import { StatusPill } from '@/components/ui/StatusPill';
import { fieldCheckStageLabel } from '@/lib/reports/fieldCheckReport';
import type { ReportRunResult } from '@/lib/reports/runReport';
import { AGING_BUCKET_LABEL } from '@/lib/reports/types';
import { formatUsdFromCents } from '@/lib/format/money';
import styles from './reports.module.scss';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ReportResultTable({
  result,
  page,
  pageSize,
  showFooter = true,
}: {
  result: ReportRunResult;
  page: number;
  pageSize: number;
  /** When false, parent renders ReportPagination instead of the simple footer. */
  showFooter?: boolean;
}) {
  if (result.kind === 'pro-placeholder') {
    return <p className={styles.empty}>This report is coming in a future release.</p>;
  }

  switch (result.kind) {
    case 'outstanding-balances': {
      const rows = result.data.rows;
      const slice = paginate(rows, page, pageSize);
      return (
        <TableShell total={rows.length} start={slice.start} end={slice.end} showFooter={showFooter}>
          <table className={styles.directoryTable}>
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Invoice</th>
                <th scope="col">Aging</th>
                <th scope="col">Due</th>
                <th scope="col">Balance</th>
              </tr>
            </thead>
            <tbody>
              {slice.items.map((row) => (
                <tr key={row.invoiceId}>
                  <td>{row.customerName}</td>
                  <td>
                    <Link href={`/billing/invoices/${row.invoiceId}`} className={styles.actionLink}>
                      {row.invoiceTitle}
                    </Link>
                  </td>
                  <td>{AGING_BUCKET_LABEL[row.agingBucket]}</td>
                  <td>{row.dueDate ? formatDate(row.dueDate) : '—'}</td>
                  <td>{formatUsdFromCents(row.remainingCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      );
    }
    case 'invoice-audit': {
      const rows = result.data.rows;
      const slice = paginate(rows, page, pageSize);
      return (
        <TableShell total={rows.length} start={slice.start} end={slice.end} showFooter={showFooter}>
          <table className={styles.directoryTable}>
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Invoice</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
                <th scope="col">Total</th>
                <th scope="col">Balance</th>
              </tr>
            </thead>
            <tbody>
              {slice.items.map((row) => (
                <tr key={row.invoiceId}>
                  <td>{row.customerName}</td>
                  <td>
                    <Link href={`/billing/invoices/${row.invoiceId}`} className={styles.actionLink}>
                      {row.title}
                    </Link>
                  </td>
                  <td>
                    <StatusPill tone={row.status === 'paid' ? 'success' : 'neutral'}>
                      {row.status}
                    </StatusPill>
                  </td>
                  <td>{formatDate(row.createdAt)}</td>
                  <td>{formatUsdFromCents(row.amountCents)}</td>
                  <td>{formatUsdFromCents(row.remainingCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      );
    }
    case 'field-check-tracking': {
      const rows = result.data.rows;
      const slice = paginate(rows, page, pageSize);
      return (
        <>
          <p className={styles.hint}>
            Mark checks received or deposited in{' '}
            <Link href="/billing/payment-audits" className={styles.actionLink}>
              Payment audits
            </Link>
            .
          </p>
          <TableShell total={rows.length} start={slice.start} end={slice.end} showFooter={showFooter}>
            <table className={styles.directoryTable}>
              <thead>
                <tr>
                  <th scope="col">Recorded</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Invoice</th>
                  <th scope="col">Check ref</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Stage</th>
                </tr>
              </thead>
              <tbody>
                {slice.items.map((row) => (
                  <tr key={row.paymentId}>
                    <td>{formatDate(row.recordedAt)}</td>
                    <td>{row.customerName}</td>
                    <td>
                      {row.invoiceId ? (
                        <Link
                          href={`/billing/invoices/${row.invoiceId}`}
                          className={styles.actionLink}
                        >
                          {row.invoiceTitle}
                        </Link>
                      ) : (
                        row.invoiceTitle
                      )}
                    </td>
                    <td>{row.checkReference}</td>
                    <td>{formatUsdFromCents(row.amountCents)}</td>
                    <td>{fieldCheckStageLabel(row.stage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        </>
      );
    }
    case 'collections-summary': {
      const rows = result.data.byMethod;
      return (
        <TableShell total={rows.length} start={1} end={rows.length} showFooter={showFooter}>
          <table className={styles.directoryTable}>
            <thead>
              <tr>
                <th scope="col">Method</th>
                <th scope="col">Payments</th>
                <th scope="col">Gross</th>
                <th scope="col">Refunds</th>
                <th scope="col">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.method}>
                  <td>{row.method}</td>
                  <td>{row.paymentCount}</td>
                  <td>{formatUsdFromCents(row.grossCents)}</td>
                  <td>{formatUsdFromCents(row.refundCents)}</td>
                  <td>{formatUsdFromCents(row.netCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      );
    }
    case 'quote-pipeline': {
      const rows = result.data.byStatus;
      return (
        <TableShell total={rows.length} start={1} end={rows.length} showFooter={showFooter}>
          <table className={styles.directoryTable}>
            <thead>
              <tr>
                <th scope="col">Status</th>
                <th scope="col">Count</th>
                <th scope="col">Total value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.status}>
                  <td>{row.status}</td>
                  <td>{row.count}</td>
                  <td>{formatUsdFromCents(row.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      );
    }
    case 'payment-reconciliation': {
      const { connectComplete, byMethod, byPayout, pendingCardCount, pendingCardNetCents } =
        result.data;

      return (
        <>
          {!connectComplete ? (
            <p className={styles.hint}>
              Stripe Connect is not complete — card payout batches appear after payment setup at{' '}
              <Link href="/billing/payment-setup" className={styles.actionLink}>
                Payment setup
              </Link>
              .
            </p>
          ) : null}

          {connectComplete && byPayout.length > 0 ? (
            <>
              <h3 className={styles.sectionHeading}>Card deposits by payout</h3>
              <TableShell
                total={byPayout.length}
                start={1}
                end={byPayout.length}
                showFooter={showFooter}
              >
                <table className={styles.directoryTable}>
                  <thead>
                    <tr>
                      <th scope="col">Arrival</th>
                      <th scope="col">Payout</th>
                      <th scope="col">Status</th>
                      <th scope="col">Payments</th>
                      <th scope="col">Gross</th>
                      <th scope="col">Fees</th>
                      <th scope="col">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byPayout.map((row) => (
                      <tr key={row.stripePayoutId}>
                        <td>{row.arrivalDate ? formatDate(row.arrivalDate) : '—'}</td>
                        <td>
                          <code className={styles.mono}>{row.stripePayoutId}</code>
                        </td>
                        <td>{row.status ?? '—'}</td>
                        <td>{row.paymentCount}</td>
                        <td>{formatUsdFromCents(row.grossCents)}</td>
                        <td>{formatUsdFromCents(row.feeCents)}</td>
                        <td>{formatUsdFromCents(row.netCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableShell>
            </>
          ) : connectComplete ? (
            <p className={styles.hint}>
              No linked card payouts in this range yet. New deposits are linked when Stripe sends{' '}
              <code className={styles.mono}>payout.paid</code>.
            </p>
          ) : null}

          {pendingCardCount > 0 ? (
            <p className={styles.hint}>
              {pendingCardCount} card payment(s) ({formatUsdFromCents(pendingCardNetCents)} net) not
              assigned to a payout batch yet.
            </p>
          ) : null}

          <h3 className={styles.sectionHeading}>All methods</h3>
          <TableShell total={byMethod.length} start={1} end={byMethod.length} showFooter={showFooter}>
            <table className={styles.directoryTable}>
              <thead>
                <tr>
                  <th scope="col">Method</th>
                  <th scope="col">Payments</th>
                  <th scope="col">Gross</th>
                  <th scope="col">Fees</th>
                  <th scope="col">Net</th>
                </tr>
              </thead>
              <tbody>
                {byMethod.map((row) => (
                  <tr key={row.method}>
                    <td>{row.method}</td>
                    <td>{row.paymentCount}</td>
                    <td>{formatUsdFromCents(row.grossCents)}</td>
                    <td>{formatUsdFromCents(row.feeCents)}</td>
                    <td>{formatUsdFromCents(row.netCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        </>
      );
    }
    case 'revenue-by-customer': {
      const rows = result.data.rows;
      const slice = paginate(rows, page, pageSize);
      return (
        <TableShell total={rows.length} start={slice.start} end={slice.end} showFooter={showFooter}>
          <table className={styles.directoryTable}>
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Payments</th>
                <th scope="col">Net revenue</th>
              </tr>
            </thead>
            <tbody>
              {slice.items.map((row) => (
                <tr key={row.customerId}>
                  <td>
                    <Link href={`/customers/${row.customerId}`} className={styles.actionLink}>
                      {row.customerName}
                    </Link>
                  </td>
                  <td>{row.paymentCount}</td>
                  <td>{formatUsdFromCents(row.netCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      );
    }
    case 'revenue-by-service': {
      const rows = result.data.rows;
      const slice = paginate(rows, page, pageSize);
      return (
        <TableShell total={rows.length} start={slice.start} end={slice.end} showFooter={showFooter}>
          <table className={styles.directoryTable}>
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col">Line items</th>
                <th scope="col">Accepted value</th>
              </tr>
            </thead>
            <tbody>
              {slice.items.map((row) => (
                <tr key={row.serviceLabel}>
                  <td>{row.serviceLabel}</td>
                  <td>{row.lineCount}</td>
                  <td>{formatUsdFromCents(row.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      );
    }
    case 'recurring-revenue': {
      const rows = result.data.rows;
      const slice = paginate(rows, page, pageSize);
      return (
        <TableShell total={rows.length} start={slice.start} end={slice.end} showFooter={showFooter}>
          <table className={styles.directoryTable}>
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Plan</th>
                <th scope="col">Status</th>
                <th scope="col">MRR</th>
                <th scope="col">Interval</th>
                <th scope="col">Period end</th>
              </tr>
            </thead>
            <tbody>
              {slice.items.map((row) => (
                <tr key={row.subscriptionId}>
                  <td>{row.customerName}</td>
                  <td>{row.planName}</td>
                  <td>{row.status}</td>
                  <td>{formatUsdFromCents(row.monthlyCents)}</td>
                  <td>{row.billingInterval}</td>
                  <td>{row.periodEnd ? formatDate(row.periodEnd) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      );
    }
    case 'employee-performance': {
      const rows = result.data.rows;
      const slice = paginate(rows, page, pageSize);
      return (
        <TableShell total={rows.length} start={slice.start} end={slice.end} showFooter={showFooter}>
          <table className={styles.directoryTable}>
            <thead>
              <tr>
                <th scope="col">Team member</th>
                <th scope="col">Jobs completed</th>
                <th scope="col">Scheduled hours</th>
              </tr>
            </thead>
            <tbody>
              {slice.items.map((row) => (
                <tr key={row.userId}>
                  <td>{row.displayName}</td>
                  <td>{row.jobsCompleted}</td>
                  <td>{row.scheduledHours.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      );
    }
    case 'sales-tax-summary': {
      const rows = result.data.rows;
      const slice = paginate(rows, page, pageSize);
      return (
        <>
          {result.data.missingPropertyCount > 0 ? (
            <p className={styles.hint}>
              {result.data.missingPropertyCount} accepted quote(s) lack a property with state — tax
              situs may be incomplete.
            </p>
          ) : null}
          <TableShell total={rows.length} start={slice.start} end={slice.end} showFooter={showFooter}>
            <table className={styles.directoryTable}>
              <thead>
                <tr>
                  <th scope="col">Jurisdiction</th>
                  <th scope="col">Quotes</th>
                  <th scope="col">Taxable amount</th>
                  <th scope="col">Tax (est.)</th>
                </tr>
              </thead>
              <tbody>
                {slice.items.map((row) => (
                  <tr key={row.jurisdictionKey}>
                    <td>{row.jurisdictionKey}</td>
                    <td>{row.quoteCount}</td>
                    <td>{formatUsdFromCents(row.taxableCents)}</td>
                    <td>{formatUsdFromCents(row.taxCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        </>
      );
    }
    case 'payroll-export': {
      const rows = result.data.rows;
      const slice = paginate(rows, page, pageSize);
      return (
        <>
          <p className={styles.hint}>
            Variable pay uses active rules from{' '}
            <Link href="/settings/compensation" className={styles.actionLink}>
              Settings → Compensation
            </Link>
            .
          </p>
          <TableShell total={rows.length} start={slice.start} end={slice.end} showFooter={showFooter}>
          <table className={styles.directoryTable}>
            <thead>
              <tr>
                <th scope="col">Employee</th>
                <th scope="col">Jobs</th>
                <th scope="col">Regular hours</th>
                <th scope="col">Overtime hours</th>
                <th scope="col">Variable pay (est.)</th>
              </tr>
            </thead>
            <tbody>
              {slice.items.map((row) => (
                <tr key={row.userId}>
                  <td>{row.employeeName}</td>
                  <td>{row.jobsCompleted}</td>
                  <td>{row.regularHours.toFixed(1)}</td>
                  <td>{row.overtimeHours.toFixed(1)}</td>
                  <td>{formatUsdFromCents(row.estimatedVariablePayCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
        </>
      );
    }
    case 'crew-utilization': {
      const rows = result.data.rows;
      const slice = paginate(rows, page, pageSize);
      return (
        <TableShell total={rows.length} start={slice.start} end={slice.end} showFooter={showFooter}>
          <table className={styles.directoryTable}>
            <thead>
              <tr>
                <th scope="col">Team member</th>
                <th scope="col">Scheduled hours</th>
                <th scope="col">Capacity</th>
                <th scope="col">Utilization</th>
              </tr>
            </thead>
            <tbody>
              {slice.items.map((row) => (
                <tr key={row.userId}>
                  <td>{row.displayName}</td>
                  <td>{row.scheduledHours.toFixed(1)}</td>
                  <td>{row.capacityHours.toFixed(1)}</td>
                  <td>{row.utilizationPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      );
    }
    case 'on-time-arrival': {
      const rows = result.data.rows;
      const slice = paginate(rows, page, pageSize);
      return (
        <TableShell total={rows.length} start={slice.start} end={slice.end} showFooter={showFooter}>
          <table className={styles.directoryTable}>
            <thead>
              <tr>
                <th scope="col">Job</th>
                <th scope="col">Scheduled start</th>
                <th scope="col">Checked in</th>
                <th scope="col">Minutes late</th>
                <th scope="col">On time</th>
              </tr>
            </thead>
            <tbody>
              {slice.items.map((row) => (
                <tr key={row.visitId}>
                  <td>{row.title}</td>
                  <td>{formatDate(row.scheduledStart)}</td>
                  <td>{row.checkedInAt ? formatDate(row.checkedInAt) : '—'}</td>
                  <td>{row.minutesLate != null ? row.minutesLate : '—'}</td>
                  <td>{row.checkedInAt ? (row.onTime ? 'Yes' : 'No') : 'No check-in'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      );
    }
    case 'tips-commissions': {
      const payoutRows = result.data.payoutRows;
      const slice = paginate(payoutRows, page, pageSize);
      return (
        <>
          <p className={styles.hint}>
            Manage commission and tip rules under{' '}
            <Link href="/settings/compensation" className={styles.actionLink}>
              Settings → Compensation
            </Link>
            .
          </p>
          <TableShell
            total={payoutRows.length}
            start={slice.start}
            end={slice.end}
            showFooter={showFooter}
          >
            <table className={styles.directoryTable}>
              <thead>
                <tr>
                  <th scope="col">Team member</th>
                  <th scope="col">Jobs</th>
                  <th scope="col">Commission</th>
                  <th scope="col">Flat</th>
                  <th scope="col">Tip split</th>
                  <th scope="col">Total (est.)</th>
                </tr>
              </thead>
              <tbody>
                {slice.items.map((row) => (
                  <tr key={row.userId}>
                    <td>{row.employeeName}</td>
                    <td>{row.jobsCompleted}</td>
                    <td>{formatUsdFromCents(row.commissionCents)}</td>
                    <td>{formatUsdFromCents(row.flatCents)}</td>
                    <td>{formatUsdFromCents(row.tipSplitCents)}</td>
                    <td>{formatUsdFromCents(row.estimatedPayCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
          {result.data.ruleRows.length > 0 ? (
            <>
              <h3 className={styles.sectionHeading}>Active rules</h3>
              <table className={styles.directoryTable}>
                <thead>
                  <tr>
                    <th scope="col">Rule</th>
                    <th scope="col">Type</th>
                    <th scope="col">Rate</th>
                    <th scope="col">Applies to</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.ruleRows
                    .filter((r) => r.isActive)
                    .map((row) => (
                      <tr key={row.ruleId}>
                        <td>{row.name}</td>
                        <td>{row.ruleType}</td>
                        <td>{row.rateLabel}</td>
                        <td>{row.appliesToRole}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </>
          ) : null}
        </>
      );
    }
    case 'processing-fees-deductible': {
      const rows = result.data.rows;
      const slice = paginate(rows, page, pageSize);
      return (
        <TableShell total={rows.length} start={slice.start} end={slice.end} showFooter={showFooter}>
          <table className={styles.directoryTable}>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Method</th>
                <th scope="col">Payments</th>
                <th scope="col">Gross</th>
                <th scope="col">Fees</th>
                <th scope="col">Net</th>
              </tr>
            </thead>
            <tbody>
              {slice.items.map((row) => (
                <tr key={`${row.periodMonth}-${row.method}`}>
                  <td>{row.periodMonth}</td>
                  <td>{row.method}</td>
                  <td>{row.paymentCount}</td>
                  <td>{formatUsdFromCents(row.grossCents)}</td>
                  <td>{formatUsdFromCents(row.feeCents)}</td>
                  <td>{formatUsdFromCents(row.netCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      );
    }
    case 'year-end-revenue': {
      const rows = result.data.rows;
      const slice = paginate(rows, page, pageSize);
      return (
        <TableShell total={rows.length} start={slice.start} end={slice.end} showFooter={showFooter}>
          <table className={styles.directoryTable}>
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Payments</th>
                <th scope="col">Gross</th>
                <th scope="col">Fees</th>
                <th scope="col">Net</th>
              </tr>
            </thead>
            <tbody>
              {slice.items.map((row) => (
                <tr key={row.customerId}>
                  <td>{row.customerName}</td>
                  <td>{row.paymentCount}</td>
                  <td>{formatUsdFromCents(row.grossCents)}</td>
                  <td>{formatUsdFromCents(row.feeCents)}</td>
                  <td>{formatUsdFromCents(row.netCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      );
    }
    case 'customer-1099-prep': {
      const rows = result.data.rows;
      const slice = paginate(rows, page, pageSize);
      return (
        <TableShell total={rows.length} start={slice.start} end={slice.end} showFooter={showFooter}>
          <table className={styles.directoryTable}>
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Gross collected</th>
                <th scope="col">Payments</th>
                <th scope="col">$600+ threshold</th>
              </tr>
            </thead>
            <tbody>
              {slice.items.map((row) => (
                <tr key={row.customerId}>
                  <td>{row.customerName}</td>
                  <td>{formatUsdFromCents(row.grossCents)}</td>
                  <td>{row.paymentCount}</td>
                  <td>{row.meetsThreshold ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      );
    }
    case 'cohort-ltv-churn': {
      const rows = result.data.rows;
      const slice = paginate(rows, page, pageSize);
      return (
        <TableShell total={rows.length} start={slice.start} end={slice.end} showFooter={showFooter}>
          <table className={styles.directoryTable}>
            <thead>
              <tr>
                <th scope="col">Cohort</th>
                <th scope="col">Cohort size</th>
                <th scope="col">Month offset</th>
                <th scope="col">Active</th>
                <th scope="col">Retention %</th>
                <th scope="col">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {slice.items.map((row) => (
                <tr key={`${row.cohortMonth}-${row.monthsSinceFirst}`}>
                  <td>{row.cohortMonth}</td>
                  <td>{row.customersInCohort}</td>
                  <td>{row.monthsSinceFirst}</td>
                  <td>{row.activeCustomers}</td>
                  <td>{row.retentionPercent}%</td>
                  <td>{formatUsdFromCents(row.revenueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      );
    }
    default:
      return null;
  }
}

function paginate<T>(rows: T[], page: number, pageSize: number) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  return { items: rows.slice(start, end), start: total === 0 ? 0 : start + 1, end };
}

function TableShell({
  children,
  total,
  start,
  end,
  showFooter,
}: {
  children: React.ReactNode;
  total: number;
  start: number;
  end: number;
  showFooter: boolean;
}) {
  if (total === 0) {
    return <p className={styles.empty}>No rows match this report and date range.</p>;
  }
  return (
    <div className={styles.tablePanel}>
      <div className={styles.tableWrap}>{children}</div>
      {showFooter ? (
        <footer className={styles.directoryFooter}>
          Showing {start} to {end} of {total} rows
        </footer>
      ) : null}
    </div>
  );
}
