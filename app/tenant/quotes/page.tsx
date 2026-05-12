import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { createClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { Tables } from '@/lib/supabase/database.types';
import type { QuoteListEmbedRow } from '@/lib/tenant/quoteEmbedTypes';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import { formatQuoteMoney } from '@/lib/tenant/quoteMoney';
import { QUOTE_STATUS_LABEL } from '@/lib/tenant/quoteLabels';
import { QuoteCreateForm, type CustomerPropertyGroup } from './QuoteCreateForm';
import styles from './quotes.module.scss';

export const dynamic = 'force-dynamic';

type CustomerPickRow = {
  id: string;
  customer_identities: { full_name: string | null } | null;
};

type PropertyPickRow = Pick<
  Tables<'tenant_customer_properties'>,
  'id' | 'customer_id' | 'label' | 'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code' | 'is_primary'
>;

function propertyOptionLabel(p: PropertyPickRow): string {
  const line = formatPropertyAddressLine(p);
  const base = p.label?.trim() || line || 'Location';
  return p.is_primary ? `${base} (primary)` : base;
}

function buildCustomerPropertyGroups(rows: PropertyPickRow[]): CustomerPropertyGroup[] {
  const map = new Map<string, { id: string; label: string }[]>();
  for (const p of rows) {
    const list = map.get(p.customer_id) ?? [];
    list.push({ id: p.id, label: propertyOptionLabel(p) });
    map.set(p.customer_id, list);
  }
  return Array.from(map.entries()).map(([customerId, options]) => ({ customerId, options }));
}

export default async function TenantQuotesPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', '/quotes');

  const supabase = await createClient();

  const [quotesRes, customersRes, propertiesRes] = await Promise.all([
    supabase
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
        customers (
          customer_identities (
            full_name
          )
        ),
        tenant_customer_properties (
          label,
          address_line1,
          city
        )
      `,
      )
      .eq('tenant_id', membership.tenantId)
      .order('created_at', { ascending: false })
      .overrideTypes<QuoteListEmbedRow[], { merge: false }>(),
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
    supabase
      .from('tenant_customer_properties')
      .select('id, customer_id, label, address_line1, address_line2, city, state, postal_code, is_primary')
      .eq('tenant_id', membership.tenantId)
      .order('is_primary', { ascending: false })
      .overrideTypes<PropertyPickRow[], { merge: false }>(),
  ]);

  const quotes = quotesRes.data ?? [];
  const customerRows = customersRes.data ?? [];
  const propertyRows = propertiesRes.data ?? [];

  const customerOptions = customerRows.map((r) => ({
    id: r.id,
    label: r.customer_identities?.full_name?.trim() || 'Unnamed',
  }));

  const customerPropertyGroups = buildCustomerPropertyGroups(propertyRows);

  return (
    <>
      <PageHeader
        title="Quotes"
        description="Draft proposals and track status before work hits the schedule."
      />

      <Stack gap={6}>
        <Card title="New quote" description="Creates a draft you can send or refine.">
          <QuoteCreateForm
            tenantSlug={membership.tenantSlug}
            customerOptions={customerOptions}
            customerPropertyGroups={customerPropertyGroups}
          />
        </Card>

        <Card
          title="All quotes"
          description={quotes.length === 0 ? 'No quotes yet — add one above.' : `${quotes.length} quote${quotes.length === 1 ? '' : 's'}`}
        >
          {quotes.length === 0 ? (
            <p className={styles.empty}>Nothing here yet.</p>
          ) : (
            <ul className={styles.list}>
              {quotes.map((q) => {
                const name = q.customers?.customer_identities?.full_name?.trim();
                const who = name ? name : q.customer_id ? 'Linked customer' : 'No customer';
                const prop = q.tenant_customer_properties;
                const site = prop ? formatPropertyAddressLine(prop) : '';
                return (
                  <li key={q.id} className={styles.row}>
                    <div>
                      <Link href={`/quotes/${q.id}`} className={styles.titleLink}>
                        {q.title}
                      </Link>
                      <div className={styles.sub}>
                        {who}
                        {site ? ` · ${site}` : ''} · {formatQuoteMoney(q.amount_cents, q.currency)} ·{' '}
                        {new Date(q.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className={styles.status}>{QUOTE_STATUS_LABEL[q.status]}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </Stack>
    </>
  );
}
