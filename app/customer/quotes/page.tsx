import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { EmptyState } from '@/components/ui/EmptyState';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import {
  fetchCustomerQuoteList,
  pastCustomerQuotes,
  pendingCustomerQuotes,
} from '@/lib/customer/customerQuoteList';
import { createAdminClient } from '@/lib/supabase/server';
import { CustomerQuoteListCard } from './CustomerQuoteListCard';
import styles from './quotes.module.scss';

export const dynamic = 'force-dynamic';

type QuotesView = 'active' | 'archived';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function parseView(raw: string | undefined): QuotesView {
  return raw === 'archived' ? 'archived' : 'active';
}

export default async function CustomerQuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const view = parseView(firstParam(sp.view));
  const auth = await requirePortalAccess('customer', '/quotes');
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx) redirect('/access-denied?reason=no_customer_profile');

  const admin = createAdminClient();
  const { rows, error } = await fetchCustomerQuoteList(admin, ctx.customerIds);
  const pending = pendingCustomerQuotes(rows);
  const past = pastCustomerQuotes(rows);
  const activeTabHref = '/quotes';
  const archivedTabHref = '/quotes?view=archived';
  const activeRows = pending;
  const archivedRows = past;

  return (
    <>
      <PageHeader
        title="Quotes"
        description={
          view === 'archived'
            ? 'Accepted, declined, and expired quotes stay here for your records.'
            : pending.length > 0
              ? `${pending.length} quote${pending.length === 1 ? '' : 's'} waiting for your response.`
              : 'Review pricing from your providers and accept or decline when you are ready.'
        }
      />
      <nav className={styles.viewTabs} aria-label="Quote views">
        <Link href={activeTabHref} className={styles.viewTab} data-active={view === 'active' || undefined}>
          Active ({activeRows.length})
        </Link>
        <Link
          href={archivedTabHref}
          className={styles.viewTab}
          data-active={view === 'archived' || undefined}
        >
          Archived ({archivedRows.length})
        </Link>
      </nav>

      {error ? (
        <Card title="Could not load quotes">
          <p className={styles.muted}>{error}</p>
        </Card>
      ) : view === 'active' && activeRows.length === 0 ? (
        <EmptyState
          title="No active quotes"
          description="When a provider sends you a quote through cleanScheduler, it will appear here for review."
        />
      ) : view === 'archived' && archivedRows.length === 0 ? (
        <EmptyState
          title="No archived quotes"
          description="Accepted, declined, and expired quotes will appear here after they move out of active review."
        />
      ) : view === 'active' ? (
        <Stack gap={6}>
          <section aria-labelledby="quotes-pending-heading">
            <h2 id="quotes-pending-heading" className={styles.listSectionHeading}>
              Needs your response
            </h2>
            <ul className={styles.listCardGrid}>
              {activeRows.map((row) => (
                <li key={row.id}>
                  <CustomerQuoteListCard row={row} emphasis />
                </li>
              ))}
            </ul>
          </section>
        </Stack>
      ) : (
        <section aria-labelledby="quotes-archived-heading">
          <h2 id="quotes-archived-heading" className={styles.listSectionHeading}>
            Archived quote history
          </h2>
          <ul className={styles.listCardGrid}>
            {archivedRows.map((row) => (
              <li key={row.id}>
                <CustomerQuoteListCard row={row} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
