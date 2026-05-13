import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { Tables } from '@/lib/supabase/database.types';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import type { QuoteCustomerOption } from '@/app/tenant/quotes/QuoteCreateForm';
import type { CustomerPropertyGroup } from '@/app/tenant/quotes/QuoteCreateForm';
import { ScheduleVisitForm } from '../ScheduleVisitForm';
import styles from '../schedule.module.scss';

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

export default async function TenantScheduleNewPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', '/schedule/new');

  const supabase = createTenantPortalDbClient();

  const [customersRes, propertiesRes, quotesRes] = await Promise.all([
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

  const membersRes = await supabase
    .from('tenant_memberships')
    .select('user_id, role')
    .eq('tenant_id', membership.tenantId)
    .eq('is_active', true)
    .order('role', { ascending: true });

  const memberUserIds = [...new Set((membersRes.data ?? []).map((m) => m.user_id))];
  const { data: memberProfiles } =
    memberUserIds.length > 0
      ? await supabase.from('user_profiles').select('user_id, display_name').in('user_id', memberUserIds)
      : { data: [] as { user_id: string; display_name: string | null }[] };

  const displayByUserId = new Map((memberProfiles ?? []).map((p) => [p.user_id, p.display_name]));

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

  const employeeOptions = (membersRes.data ?? []).map((m) => ({
    id: m.user_id,
    label: `${displayByUserId.get(m.user_id)?.trim() || 'Member'} (${m.role})`,
  }));

  return (
    <>
      <PageHeader
        title="New appointment"
        description="Pick a customer, optional site, and time window. You return to the calendar when you save."
        actions={
          <Link href="/schedule" className={styles.backToSchedule}>
            ← Back to schedule
          </Link>
        }
      />

      <Card title="Appointment details" description="Required fields are marked by the browser when you submit.">
        <ScheduleVisitForm
          tenantSlug={membership.tenantSlug}
          customerOptions={customerOptions}
          customerPropertyGroups={customerPropertyGroups}
          quoteOptions={quoteOptions}
          employeeOptions={employeeOptions}
        />
      </Card>
    </>
  );
}
