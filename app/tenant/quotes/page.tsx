import Link from 'next/link';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { QuoteListEmbedRow } from '@/lib/tenant/quoteEmbedTypes';
import { QuotesBoard } from './QuotesBoard';
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

function quoteStatusLabel(status: QuoteListEmbedRow['status']): string {
  return status.replace('_', ' ');
}

export default async function TenantQuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const view = parseView(firstParam(sp.view));
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', '/quotes');

  const supabase = createTenantPortalDbClient();

  const quotesRes = await supabase
    .from('tenant_quotes')
    .select(
      `
        id,
        title,
        status,
        amount_cents,
        currency,
        created_at,
        customer_id,
        property_id,
        quote_group_id,
        version_number,
        is_locked,
        superseded_by_quote_id,
        customers (
          customer_identities (
            first_name,
            last_name,
            full_name
          )
        ),
        tenant_customer_properties (
          label,
          address_line1,
          address_line2,
          city,
          state,
          postal_code
        )
      `,
    )
    .eq('tenant_id', membership.tenantId)
    .is('superseded_by_quote_id', null)
    .overrideTypes<QuoteListEmbedRow[], { merge: false }>();

  const quotes = quotesRes.data ?? [];
  const quoteIds = quotes.map((q) => q.id);
  const { data: visitsWithQuote } =
    quoteIds.length === 0
      ? { data: [] as { quote_id: string | null }[] }
      : await supabase
          .from('tenant_scheduled_visits')
          .select('quote_id')
          .eq('tenant_id', membership.tenantId)
          .in('quote_id', quoteIds);
  const scheduledQuoteIds = new Set(
    (visitsWithQuote ?? []).map((row) => row.quote_id).filter((id): id is string => Boolean(id)),
  );
  const archivedQuotes = quotes.filter(
    (q) => q.status === 'accepted' && scheduledQuoteIds.has(q.id),
  );
  const archivedQuoteIdSet = new Set(archivedQuotes.map((q) => q.id));
  const activeQuotes = quotes.filter((q) => !archivedQuoteIdSet.has(q.id));
  const activeTabHref = '/quotes';
  const archivedTabHref = '/quotes?view=archived';

  return (
    <>
      <PageHeader
        title="Quotes"
        titleHint={
          view === 'archived'
            ? 'Accepted quotes move here after they are attached to scheduled work.'
            : 'Drag cards between columns on desktop, or use Move to on smaller screens.'
        }
        actions={
          <Button variant="primary" as="a" href="/quotes/new" iconLeft={<Plus size={16} />}>
            Add quote
          </Button>
        }
      />

      <Stack gap={6}>
        <nav className={styles.viewTabs} aria-label="Quote views">
          <Link
            href={activeTabHref}
            className={styles.viewTab}
            data-active={view === 'active' || undefined}
          >
            Active pipeline ({activeQuotes.length})
          </Link>
          <Link
            href={archivedTabHref}
            className={styles.viewTab}
            data-active={view === 'archived' || undefined}
          >
            Archived history ({archivedQuotes.length})
          </Link>
        </nav>

        {quotesRes.error ? (
          <Card>
            <p className={styles.empty} role="alert">
              Could not load quotes ({quotesRes.error.message}).
            </p>
          </Card>
        ) : view === 'active' && activeQuotes.length === 0 ? (
          <Card>
            <p className={styles.empty}>
              Nothing here yet.{' '}
              <Link href="/quotes/new" className={styles.inlineLink}>
                Add your first quote
              </Link>
            </p>
          </Card>
        ) : view === 'archived' && archivedQuotes.length === 0 ? (
          <Card>
            <p className={styles.empty}>
              No archived quotes yet. Accepted quotes appear here after they are tied to a scheduled
              visit.
            </p>
          </Card>
        ) : view === 'archived' ? (
          <Card
            title="Archived quote history"
            description="Accepted quotes retained for records and customer history."
          >
            <ul className={styles.list}>
              {archivedQuotes.map((quote) => (
                <li key={quote.id} className={styles.row}>
                  <div>
                    <Link href={`/quotes/${quote.id}`} className={styles.titleLink}>
                      {quote.title}
                    </Link>
                    <p className={styles.sub}>
                      Created {new Date(quote.created_at).toLocaleDateString()} · v
                      {quote.version_number}
                    </p>
                  </div>
                  <span className={styles.status}>{quoteStatusLabel(quote.status)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <QuotesBoard tenantSlug={membership.tenantSlug} quotes={activeQuotes} />
        )}
      </Stack>
    </>
  );
}
