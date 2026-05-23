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

export default async function CustomerQuotesPage() {
  const auth = await requirePortalAccess('customer', '/quotes');
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx) redirect('/access-denied?reason=no_customer_profile');

  const admin = createAdminClient();
  const { rows, error } = await fetchCustomerQuoteList(admin, ctx.customerIds);
  const pending = pendingCustomerQuotes(rows);
  const past = pastCustomerQuotes(rows);

  return (
    <>
      <PageHeader
        title="Quotes"
        description={
          pending.length > 0
            ? `${pending.length} quote${pending.length === 1 ? '' : 's'} waiting for your response.`
            : 'Review pricing from your providers and accept or decline when you are ready.'
        }
      />

      {error ? (
        <Card title="Could not load quotes">
          <p className={styles.muted}>{error}</p>
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No quotes yet"
          description="When a provider sends you a quote through cleanScheduler, it will show up here with status and amount."
        />
      ) : (
        <Stack gap={6}>
          {pending.length > 0 ? (
            <section aria-labelledby="quotes-pending-heading">
              <h2 id="quotes-pending-heading" className={styles.listSectionHeading}>
                Needs your response
              </h2>
              <ul className={styles.listCardGrid}>
                {pending.map((row) => (
                  <li key={row.id}>
                    <CustomerQuoteListCard row={row} emphasis />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {past.length > 0 ? (
            <section aria-labelledby="quotes-past-heading">
              <h2 id="quotes-past-heading" className={styles.listSectionHeading}>
                {pending.length > 0 ? 'Past quotes' : 'Your quotes'}
              </h2>
              <ul className={styles.listCardGrid}>
                {past.map((row) => (
                  <li key={row.id}>
                    <CustomerQuoteListCard row={row} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </Stack>
      )}
    </>
  );
}
