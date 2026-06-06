import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { Tables } from '@/lib/supabase/database.types';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import { loadJobTypeCatalog } from '@/lib/tenant/jobTypeCatalog';
import { loadTenantOperationalSettings } from '@/lib/tenant/loadTenantOperationalSettings';
import { isTenantAutoScheduleEnabled } from '@/lib/tenant/operationalSettings';
import { createAdminClient } from '@/lib/supabase/server';
import { QuoteCreateWizard } from '../QuoteCreateWizard';
import type { CustomerPropertyGroup } from '../quoteFormTypes';
import styles from '../quotes.module.scss';

export const dynamic = 'force-dynamic';

type CustomerPickRow = {
  id: string;
  customer_identities: {
    first_name: string | null;
    last_name: string | null;
    full_name: string | null;
  } | null;
};

type PropertyPickRow = Pick<
  Tables<'tenant_customer_properties'>,
  | 'id'
  | 'customer_id'
  | 'label'
  | 'address_line1'
  | 'address_line2'
  | 'city'
  | 'state'
  | 'postal_code'
  | 'is_primary'
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

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TenantQuoteNewPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const defaultCustomerId = firstParam(sp.customer_id)?.trim() ?? '';
  const defaultPropertyId = firstParam(sp.property_id)?.trim() ?? '';

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
          first_name,
          last_name,
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
      .select(
        'id, customer_id, label, address_line1, address_line2, city, state, postal_code, is_primary',
      )
      .eq('tenant_id', membership.tenantId)
      .order('is_primary', { ascending: false })
      .overrideTypes<PropertyPickRow[], { merge: false }>(),
  ]);

  const customerRows = customersRes.data ?? [];
  const propertyRows = propertiesRes.data ?? [];

  const customerOptions = customerRows.map((r) => ({
    id: r.id,
    label: r.customer_identities ? formatCustomerDisplayName(r.customer_identities) : 'Unnamed',
  }));

  const customerPropertyGroups = buildCustomerPropertyGroups(propertyRows);

  const admin = createAdminClient();
  const [jobTypeCatalog, ops] = await Promise.all([
    loadJobTypeCatalog(admin, membership.tenantId, { activeOnly: true }),
    loadTenantOperationalSettings(admin, membership.tenantId),
  ]);
  const autoScheduleEnabled = isTenantAutoScheduleEnabled(ops.acceptedQuoteScheduleMode);

  return (
    <>
      <PageHeader
        title="New quote"
        description="Step through customer, property, scope, and pricing — then save a draft or send to the customer."
        breadcrumbs={[{ label: 'Quotes', href: '/quotes' }, { label: 'New quote' }]}
        actions={
          <Link href="/quotes" className={styles.backLink}>
            ← All quotes
          </Link>
        }
      />

      <Stack gap={6}>
        <QuoteCreateWizard
          tenantSlug={membership.tenantSlug}
          customerOptions={customerOptions}
          customerPropertyGroups={customerPropertyGroups}
          jobTypeCatalog={jobTypeCatalog}
          autoScheduleEnabled={autoScheduleEnabled}
          defaults={{
            customerId: defaultCustomerId,
            propertyId: defaultPropertyId,
          }}
        />
      </Stack>
    </>
  );
}
