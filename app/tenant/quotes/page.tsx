import Link from 'next/link';
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

export default async function TenantQuotesPage() {
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

  return (
    <>
      <PageHeader
        title="Quotes"
        description="Board by status — drag cards between columns on desktop, or use Move to on smaller screens."
        actions={
          <Button variant="primary" as="a" href="/quotes/new">
            Add quote
          </Button>
        }
      />

      <Stack gap={6}>
        <Card
          title="Quote board"
          description={
            quotes.length === 0
              ? 'No quotes yet — create one to start your pipeline.'
              : `${quotes.length} quote${quotes.length === 1 ? '' : 's'} · Drag to change status`
          }
        >
          {quotesRes.error ? (
            <p className={styles.empty} role="alert">
              Could not load quotes ({quotesRes.error.message}).
            </p>
          ) : quotes.length === 0 ? (
            <p className={styles.empty}>
              Nothing here yet.{' '}
              <Link href="/quotes/new" className={styles.inlineLink}>
                Add your first quote
              </Link>
            </p>
          ) : (
            <QuotesBoard tenantSlug={membership.tenantSlug} quotes={quotes} />
          )}
        </Card>
      </Stack>
    </>
  );
}
