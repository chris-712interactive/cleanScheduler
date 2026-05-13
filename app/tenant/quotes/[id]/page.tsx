import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { Tables } from '@/lib/supabase/database.types';
import type { QuoteDetailEmbedRow } from '@/lib/tenant/quoteEmbedTypes';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import { formatQuoteMoney } from '@/lib/tenant/quoteMoney';
import { QUOTE_STATUS_LABEL } from '@/lib/tenant/quoteLabels';
import { QUOTE_LINE_FREQUENCY_LABEL } from '@/lib/tenant/quoteLineFrequency';
import { QuoteEditForm } from '../QuoteEditForm';
import type { CustomerPropertyGroup } from '../QuoteCreateForm';
import styles from '../quotes.module.scss';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

  const supabase = createTenantPortalDbClient();

  const [quoteRes, customersRes, propertiesRes] = await Promise.all([
    supabase
      .from('tenant_quotes')
      .select(
        `
        *,
        tenant_customer_properties (
          label,
          address_line1,
          address_line2,
          city,
          state,
          postal_code
        ),
        tenant_quote_line_items (
          id,
          sort_order,
          service_label,
          frequency,
          frequency_detail,
          amount_cents
        )
      `,
      )
      .eq('id', id)
      .eq('tenant_id', membership.tenantId)
      .maybeSingle()
      .overrideTypes<QuoteDetailEmbedRow, { merge: false }>(),
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

  const row = quoteRes.data;
  if (quoteRes.error || !row) {
    notFound();
  }

  const customerRows = customersRes.data ?? [];
  const propertyRows = propertiesRes.data ?? [];

  const customerOptions = customerRows.map((r) => ({
    id: r.id,
    label: r.customer_identities?.full_name?.trim() || 'Unnamed',
  }));

  const customerPropertyGroups = buildCustomerPropertyGroups(propertyRows);

  const siteLine = row.tenant_customer_properties
    ? formatPropertyAddressLine(row.tenant_customer_properties)
    : '';

  const quoteLineItems = [...(row.tenant_quote_line_items ?? [])].sort((a, b) => a.sort_order - b.sort_order);

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
              {
                key: 'Service location',
                value: siteLine || '—',
              },
            ]}
          />
        </Card>

        {quoteLineItems.length > 0 ? (
          <Card title="Services" description="Priced lines on this quote.">
            <div className={styles.servicesTableWrap}>
              <table className={styles.servicesTable}>
                <thead>
                  <tr>
                    <th scope="col">Service</th>
                    <th scope="col">Cadence</th>
                    <th scope="col">Detail</th>
                    <th scope="col">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quoteLineItems.map((line) => (
                    <tr key={line.id}>
                      <td>{line.service_label}</td>
                      <td>{QUOTE_LINE_FREQUENCY_LABEL[line.frequency]}</td>
                      <td>{line.frequency_detail?.trim() ? line.frequency_detail : '—'}</td>
                      <td>{formatQuoteMoney(line.amount_cents, row.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        <Card title="Edit quote" description="Update status, amount, customer, and service site.">
          <QuoteEditForm
            tenantSlug={membership.tenantSlug}
            customerOptions={customerOptions}
            customerPropertyGroups={customerPropertyGroups}
            snapshot={{
              quoteId: row.id,
              title: row.title,
              status: row.status,
              customerId: row.customer_id ?? '',
              propertyId: row.property_id ?? '',
              amountCents: row.amount_cents,
              notes: row.notes ?? '',
              validUntilYmd: toDateInputValue(row.valid_until),
              lineItems: quoteLineItems,
            }}
          />
        </Card>
      </Stack>
    </>
  );
}
