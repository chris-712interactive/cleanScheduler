import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { createAdminClient } from '@/lib/supabase/server';
import { formatQuoteMoney } from '@/lib/tenant/quoteMoney';
import { QUOTE_STATUS_LABEL, type QuoteStatus } from '@/lib/tenant/quoteLabels';
import styles from './quotes.module.scss';

export const dynamic = 'force-dynamic';

type CustomerQuoteListRow = {
  id: string;
  title: string;
  status: QuoteStatus;
  amount_cents: number | null;
  currency: string;
  created_at: string;
  updated_at: string;
  version_number: number;
  customer_id: string | null;
  tenants: { name: string } | null;
};

export default async function CustomerQuotesPage() {
  const auth = await requirePortalAccess('customer', '/quotes');
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx) redirect('/access-denied?reason=no_customer_profile');

  const admin = createAdminClient();

  const { data: quotes, error } =
    ctx.customerIds.length > 0
      ? await admin
          .from('tenant_quotes')
          .select(
            `
            id,
            title,
            status,
            amount_cents,
            currency,
            created_at,
            updated_at,
            version_number,
            customer_id,
            tenants:tenants!inner ( name )
          `,
          )
          .in('customer_id', ctx.customerIds)
          .is('superseded_by_quote_id', null)
          .order('updated_at', { ascending: false })
      : { data: [] as CustomerQuoteListRow[], error: null };

  const list = (quotes ?? []) as CustomerQuoteListRow[];

  return (
    <>
      <PageHeader
        title="Quotes"
        description="Proposals and pricing from your connected providers. Open a quote to see line items and version history."
      />

      {error ? (
        <Card title="Could not load quotes">
          <p className={styles.muted}>{error.message}</p>
        </Card>
      ) : !list.length ? (
        <EmptyState
          title="No quotes yet"
          description="When a provider sends you a quote through cleanScheduler, it will show up here with status and amount."
        />
      ) : (
        <Stack gap={3}>
          {list.map((row) => {
            const t = row.tenants as { name: string } | null;
            return (
              <Card key={row.id} title={row.title} description={t?.name ?? 'Provider'}>
                <div className={styles.row}>
                  <StatusPill tone={row.status === 'accepted' ? 'brand' : row.status === 'declined' ? 'neutral' : 'info'}>
                    {QUOTE_STATUS_LABEL[row.status]}
                  </StatusPill>
                  <span>
                    <strong>{formatQuoteMoney(row.amount_cents, row.currency)}</strong>
                    {row.version_number > 1 ? (
                      <span className={styles.muted}> · version {row.version_number}</span>
                    ) : null}
                  </span>
                </div>
                <p className={styles.meta}>
                  Updated {new Date(row.updated_at).toLocaleDateString()}
                  {row.created_at !== row.updated_at
                    ? ` · created ${new Date(row.created_at).toLocaleDateString()}`
                    : ''}
                </p>
                <p className={styles.meta}>
                  <Link href={`/quotes/${row.id}`} className={styles.titleLink}>
                    View details →
                  </Link>
                </p>
              </Card>
            );
          })}
        </Stack>
      )}
    </>
  );
}
