import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  formatInvoiceListDate,
  formatInvoiceListHeading,
  invoiceListStatusLabel,
  invoiceListStatusTone,
} from '@/lib/billing/invoiceListDisplay';
import { formatUsdFromCents } from '@/lib/format/money';
import { getCustomerActivitySnapshot } from '@/lib/tenant/customerActivity';
import { QUOTE_STATUS_LABEL, type QuoteStatus } from '@/lib/tenant/quoteLabels';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import styles from './customers.module.scss';

interface Props {
  tenantId: string;
  customerId: string;
}

function formatVisitWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function ActivitySection({
  title,
  empty,
  viewAllHref,
  children,
}: {
  title: string;
  empty: string;
  viewAllHref: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.activitySection}>
      <div className={styles.activitySectionHeader}>
        <h3 className={styles.activitySectionTitle}>{title}</h3>
        <Link href={viewAllHref} className={styles.activityViewAll}>
          View all
        </Link>
      </div>
      {children ?? <p className={styles.muted}>{empty}</p>}
    </section>
  );
}

export async function CustomerActivityPanel({ tenantId, customerId }: Props) {
  const db = createTenantPortalDbClient();
  const activity = await getCustomerActivitySnapshot(db, tenantId, customerId);

  const hasAny =
    activity.quotes.length > 0 ||
    activity.invoices.length > 0 ||
    activity.visits.length > 0 ||
    activity.payments.length > 0;

  return (
    <Card
      title="Activity"
      description="Recent quotes, jobs, invoices, and payments for this customer."
    >
      {!hasAny ? (
        <p className={styles.muted}>
          Nothing recorded yet. Create a quote or invoice to start building this customer&apos;s
          history.
        </p>
      ) : (
        <div className={styles.activityGrid}>
          <ActivitySection title="Quotes" empty="No quotes yet." viewAllHref="/quotes">
            {activity.quotes.length > 0 ? (
              <ul className={styles.activityList}>
                {activity.quotes.map((quote) => (
                  <li key={quote.id}>
                    <Link href={`/quotes/${quote.id}`} className={styles.activityRow}>
                      <span className={styles.activityPrimary}>{quote.title}</span>
                      <span className={styles.activityMeta}>
                        {QUOTE_STATUS_LABEL[quote.status as QuoteStatus] ?? quote.status} ·{' '}
                        {formatUsdFromCents(quote.amountCents)} ·{' '}
                        {formatInvoiceListDate(quote.createdAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </ActivitySection>

          <ActivitySection title="Scheduled visits" empty="No visits yet." viewAllHref="/schedule">
            {activity.visits.length > 0 ? (
              <ul className={styles.activityList}>
                {activity.visits.map((visit) => (
                  <li key={visit.id}>
                    <Link href={`/schedule/${visit.id}`} className={styles.activityRow}>
                      <span className={styles.activityPrimary}>{visit.title}</span>
                      <span className={styles.activityMeta}>
                        {visit.status} · {formatVisitWhen(visit.startsAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </ActivitySection>

          <ActivitySection
            title="Invoices"
            empty="No invoices yet."
            viewAllHref="/billing/invoices"
          >
            {activity.invoices.length > 0 ? (
              <ul className={styles.activityList}>
                {activity.invoices.map((invoice) => (
                  <li key={invoice.id}>
                    <Link href={`/billing/invoices/${invoice.id}`} className={styles.activityRow}>
                      <span className={styles.activityPrimary}>
                        {formatInvoiceListHeading(invoice.id, invoice.title)}
                      </span>
                      <span className={styles.activityMeta}>
                        <StatusPill tone={invoiceListStatusTone(invoice.status)}>
                          {invoiceListStatusLabel(invoice.status)}
                        </StatusPill>
                        {' · '}
                        {formatUsdFromCents(invoice.amountCents - invoice.amountPaidCents)} due ·{' '}
                        {formatInvoiceListDate(invoice.createdAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </ActivitySection>

          <ActivitySection
            title="Payments"
            empty="No payments yet."
            viewAllHref="/billing/transactions"
          >
            {activity.payments.length > 0 ? (
              <ul className={styles.activityList}>
                {activity.payments.map((payment) => (
                  <li key={payment.id}>
                    <Link
                      href={`/billing/invoices/${payment.invoiceId}`}
                      className={styles.activityRow}
                    >
                      <span className={styles.activityPrimary}>
                        {formatUsdFromCents(payment.amountCents)} · {payment.method}
                      </span>
                      <span className={styles.activityMeta}>
                        {payment.invoiceTitle} · {formatInvoiceListDate(payment.recordedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </ActivitySection>
        </div>
      )}
    </Card>
  );
}
