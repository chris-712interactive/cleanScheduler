import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { createClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { Tables } from '@/lib/supabase/database.types';
import { formatQuoteMoney } from '@/lib/tenant/quoteMoney';
import { QUOTE_STATUS_LABEL } from '@/lib/tenant/quoteLabels';
import { QuoteEditForm } from '../QuoteEditForm';
import styles from '../quotes.module.scss';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CustomerPickRow = {
  id: string;
  customer_identities: { full_name: string | null } | null;
};

function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TenantQuoteDetailPage({ params }: PageProps) {
  const { id: rawId } = await params;
  const id = rawId.trim();
  if (!UUID_RE.test(id)) {
    notFound();
  }

  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', `/quotes/${id}`);

  const supabase = await createClient();

  const [quoteRes, customersRes] = await Promise.all([
    supabase
      .from('tenant_quotes')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', membership.tenantId)
      .maybeSingle()
      .overrideTypes<Tables<'tenant_quotes'>, { merge: false }>(),
    supabase
      .from('customers')
      .select(
        `
        id,
        customer_identities (
          full_name
        )
      `,
      )
      .eq('tenant_id', membership.tenantId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .overrideTypes<CustomerPickRow[], { merge: false }>(),
  ]);

  const row = quoteRes.data;
  if (quoteRes.error || !row) {
    notFound();
  }

  const customerRows = customersRes.data ?? [];
  const customerOptions = customerRows.map((r) => ({
    id: r.id,
    label: r.customer_identities?.full_name?.trim() || 'Unnamed',
  }));

  return (
    <>
      <PageHeader
        title={row.title}
        description={`${QUOTE_STATUS_LABEL[row.status]} · ${formatQuoteMoney(row.amount_cents, row.currency)}`}
        actions={
          <Link href="/quotes" className={styles.backLink}>
            ← All quotes
          </Link>
        }
      />

      <Stack gap={6}>
        <Card title="Summary" description="Read-only snapshot; edit below.">
          <KeyValueList
            items={[
              { key: 'Quote ID', value: row.id },
              {
                key: 'Created',
                value: new Date(row.created_at).toLocaleString(),
              },
              {
                key: 'Valid until',
                value: row.valid_until ? new Date(row.valid_until).toLocaleDateString() : '—',
              },
            ]}
          />
        </Card>

        <Card title="Edit quote" description="Update status, amount, and customer link.">
          <QuoteEditForm
            tenantSlug={membership.tenantSlug}
            customerOptions={customerOptions}
            snapshot={{
              quoteId: row.id,
              title: row.title,
              status: row.status,
              customerId: row.customer_id ?? '',
              amountCents: row.amount_cents,
              notes: row.notes ?? '',
              validUntilYmd: toDateInputValue(row.valid_until),
            }}
          />
        </Card>
      </Stack>
    </>
  );
}
