import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { Tables } from '@/lib/supabase/database.types';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import { QuoteCreateForm, type CustomerPropertyGroup } from '../QuoteCreateForm';
import styles from '../quotes.module.scss';

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

export default async function TenantQuoteNewPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', '/quotes/new');

  const supabase = createTenantPortalDbClient();

  const [customersRes, propertiesRes] = await Promise.all([
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
        title="New quote"
        description="Creates a draft you can send or refine."
        breadcrumbs={[
          { label: 'Quotes', href: '/quotes' },
          { label: 'New quote' },
        ]}
        actions={
          <Link href="/quotes" className={styles.backLink}>
            ← All quotes
          </Link>
        }
      />

      <Stack gap={6}>
        <Card title="Quote details" description="Optional customer and service location help downstream scheduling.">
          <QuoteCreateForm
            tenantSlug={membership.tenantSlug}
            customerOptions={customerOptions}
            customerPropertyGroups={customerPropertyGroups}
          />
        </Card>
      </Stack>
    </>
  );
}
