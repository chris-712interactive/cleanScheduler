import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { Tables } from '@/lib/supabase/database.types';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import type { QuoteCustomerOption } from '@/app/tenant/quotes/QuoteCreateForm';
import type { CustomerPropertyGroup } from '@/app/tenant/quotes/QuoteCreateForm';
import { ScheduleVisitForm } from './ScheduleVisitForm';
import { DeleteVisitButton } from './DeleteVisitButton';
import styles from './schedule.module.scss';

export const dynamic = 'force-dynamic';

type CustomerPickRow = {
  id: string;
  customer_identities: { full_name: string | null } | null;
};

type PropertyPickRow = Pick<
  Tables<'tenant_customer_properties'>,
  'id' | 'customer_id' | 'label' | 'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code' | 'is_primary'
>;

type QuotePickRow = Pick<Tables<'tenant_quotes'>, 'id' | 'title'>;

type VisitListRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: Tables<'tenant_scheduled_visits'>['status'];
  notes: string | null;
  customers: { customer_identities: { full_name: string | null } | null } | null;
  tenant_customer_properties:
    | Pick<
        Tables<'tenant_customer_properties'>,
        'label' | 'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code'
      >
    | null;
  tenant_quotes: { title: string } | null;
};

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

const VISIT_STATUS_LABEL: Record<Tables<'tenant_scheduled_visits'>['status'], string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default async function TenantSchedulePage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', '/schedule');

  const supabase = createTenantPortalDbClient();

  const [visitsRes, customersRes, propertiesRes, quotesRes] = await Promise.all([
    supabase
      .from('tenant_scheduled_visits')
      .select(
        `
        id,
        title,
        starts_at,
        ends_at,
        status,
        notes,
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
        ),
        tenant_quotes (
          title
        )
      `,
      )
      .eq('tenant_id', membership.tenantId)
      .order('starts_at', { ascending: true })
      .overrideTypes<VisitListRow[], { merge: false }>(),
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
    supabase
      .from('tenant_quotes')
      .select('id, title')
      .eq('tenant_id', membership.tenantId)
      .order('created_at', { ascending: false })
      .limit(40)
      .overrideTypes<QuotePickRow[], { merge: false }>(),
  ]);

  const visits = visitsRes.data ?? [];
  const customerRows = customersRes.data ?? [];
  const propertyRows = propertiesRes.data ?? [];
  const quoteRows = quotesRes.data ?? [];

  const customerOptions: QuoteCustomerOption[] = customerRows.map((r) => ({
    id: r.id,
    label: r.customer_identities?.full_name?.trim() || 'Unnamed',
  }));

  const customerPropertyGroups = buildCustomerPropertyGroups(propertyRows);

  const quoteOptions = quoteRows.map((q) => ({
    id: q.id,
    label: q.title,
  }));

  return (
    <>
      <PageHeader
        title="Schedule"
        description="Visits tied to customers and service locations. Crew routing comes next."
      />

      <Stack gap={6}>
        <Card title="Add visit" description="Pick a customer, optional site, and time window.">
          <ScheduleVisitForm
            tenantSlug={membership.tenantSlug}
            customerOptions={customerOptions}
            customerPropertyGroups={customerPropertyGroups}
            quoteOptions={quoteOptions}
          />
        </Card>

        <Card
          title="Upcoming & recent"
          description={
            visits.length === 0
              ? 'No visits yet — create one above.'
              : `${visits.length} visit${visits.length === 1 ? '' : 's'}`
          }
        >
          {visits.length === 0 ? (
            <p className={styles.empty}>Your calendar will fill in as you book work.</p>
          ) : (
            <ul className={styles.list}>
              {visits.map((v) => {
                const who = v.customers?.customer_identities?.full_name?.trim() || 'Customer';
                const prop = v.tenant_customer_properties;
                const site = prop
                  ? [prop.label?.trim(), formatPropertyAddressLine(prop)].filter(Boolean).join(' — ')
                  : '';
                const quoteRef = v.tenant_quotes?.title;
                return (
                  <li key={v.id} className={styles.row}>
                    <div>
                      <div className={styles.rowTitle}>{v.title}</div>
                      <div className={styles.rowMeta}>
                        {new Date(v.starts_at).toLocaleString()} → {new Date(v.ends_at).toLocaleString()}
                      </div>
                      <div className={styles.rowMeta}>
                        {who}
                        {site ? ` · ${site}` : ''}
                        {quoteRef ? ` · Quote: ${quoteRef}` : ''}
                      </div>
                      <div className={styles.rowMeta}>{VISIT_STATUS_LABEL[v.status]}</div>
                      {v.notes ? <div className={styles.rowMeta}>{v.notes}</div> : null}
                    </div>
                    <DeleteVisitButton tenantSlug={membership.tenantSlug} visitId={v.id} />
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
