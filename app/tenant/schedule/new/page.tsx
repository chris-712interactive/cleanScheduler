import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { Tables } from '@/lib/supabase/database.types';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import type { QuoteCustomerOption } from '@/app/tenant/quotes/QuoteCreateForm';
import type { CustomerPropertyGroup } from '@/app/tenant/quotes/QuoteCreateForm';
import { formatCentsAsDollars } from '@/lib/billing/parseMoney';
import { createAdminClient } from '@/lib/supabase/server';
import { loadConsultationDurationMinutes } from '@/lib/tenant/consultationDuration';
import { sanitizeInternalReturnPath } from '@/lib/tenant/customerConsultation';
import { loadJobTypeCatalog } from '@/lib/tenant/jobTypeCatalog';
import { PROPERTY_KIND_LABEL } from '@/lib/tenant/propertyKindLabels';
import { ScheduleVisitForm } from '../ScheduleVisitForm';
import styles from '../schedule.module.scss';

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

type QuotePickRow = Pick<Tables<'tenant_quotes'>, 'id' | 'title' | 'amount_cents'>;

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

export default async function TenantScheduleNewPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const defaultCustomerId = firstParam(sp.customer_id)?.trim() ?? '';
  const defaultQuoteId = firstParam(sp.quote_id)?.trim() ?? '';
  const defaultPropertyId = firstParam(sp.property_id)?.trim() ?? '';
  const defaultTitle = firstParam(sp.title)?.trim() ?? '';
  const isConsultation = firstParam(sp.purpose)?.trim() === 'consultation';
  const returnToRaw = firstParam(sp.return_to)?.trim() ?? '';

  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', '/schedule/new');

  const supabase = createTenantPortalDbClient();
  const admin = createAdminClient();

  const [
    customersRes,
    propertiesRes,
    quotesRes,
    tenantRowRes,
    consultationDurationMinutes,
    jobTypeCatalog,
  ] = await Promise.all([
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
    isConsultation
      ? Promise.resolve({ data: [] as QuotePickRow[], error: null })
      : supabase
          .from('tenant_quotes')
          .select('id, title, amount_cents')
          .eq('tenant_id', membership.tenantId)
          .order('created_at', { ascending: false })
          .limit(40)
          .overrideTypes<QuotePickRow[], { merge: false }>(),
    supabase.from('tenants').select('timezone').eq('id', membership.tenantId).maybeSingle(),
    isConsultation
      ? loadConsultationDurationMinutes(admin, membership.tenantId)
      : Promise.resolve(60),
    isConsultation
      ? loadJobTypeCatalog(admin, membership.tenantId, { activeOnly: true })
      : Promise.resolve([]),
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
      ? await supabase
          .from('user_profiles')
          .select('user_id, display_name')
          .in('user_id', memberUserIds)
      : { data: [] as { user_id: string; display_name: string | null }[] };

  const displayByUserId = new Map((memberProfiles ?? []).map((p) => [p.user_id, p.display_name]));

  const customerRows = customersRes.data ?? [];
  const propertyRows = propertiesRes.data ?? [];
  const quoteRows = quotesRes.data ?? [];
  const tenantTimezone = tenantRowRes.data?.timezone ?? 'America/New_York';

  const customerOptions: QuoteCustomerOption[] = customerRows.map((r) => ({
    id: r.id,
    label: r.customer_identities ? formatCustomerDisplayName(r.customer_identities) : 'Unnamed',
  }));

  const customerPropertyGroups = buildCustomerPropertyGroups(propertyRows);

  const quoteOptions = quoteRows.map((q) => {
    const amount =
      q.amount_cents != null && Number(q.amount_cents) > 0
        ? ` · $${formatCentsAsDollars(Number(q.amount_cents))}`
        : '';
    return {
      id: q.id,
      label: `${q.title}${amount}`,
    };
  });

  const employeeOptions = (membersRes.data ?? []).map((m) => ({
    id: m.user_id,
    label: `${displayByUserId.get(m.user_id)?.trim() || 'Member'} (${m.role})`,
  }));

  const consultationServiceTypes = jobTypeCatalog.map((entry) => ({
    id: entry.id,
    label: `${entry.service_label} · ${PROPERTY_KIND_LABEL[entry.job_type]}`,
  }));

  const returnTo = sanitizeInternalReturnPath(returnToRaw);

  return (
    <>
      <PageHeader
        title={isConsultation ? 'Schedule consultation' : 'New appointment'}
        description={
          isConsultation
            ? 'Book a walkthrough or site visit before quoting this customer.'
            : 'Pick a customer, optional site, and time window. You return to the calendar when you save.'
        }
        actions={
          <Link href={returnTo ?? '/schedule'} className={styles.backToSchedule}>
            {returnTo ? '← Back to quote' : '← Back to schedule'}
          </Link>
        }
      />

      <Card
        title={isConsultation ? 'Consultation details' : 'Appointment details'}
        description={
          isConsultation
            ? 'Consultations are separate from cleaning visits and do not require a job price.'
            : 'Required fields are marked by the browser when you submit.'
        }
      >
        <ScheduleVisitForm
          tenantSlug={membership.tenantSlug}
          tenantTimezone={tenantTimezone}
          customerOptions={customerOptions}
          customerPropertyGroups={customerPropertyGroups}
          quoteOptions={quoteOptions}
          employeeOptions={employeeOptions}
          isConsultation={isConsultation}
          consultationDurationMinutes={consultationDurationMinutes}
          consultationServiceTypes={consultationServiceTypes}
          returnTo={returnTo}
          defaults={{
            customerId: defaultCustomerId,
            quoteId: isConsultation ? undefined : defaultQuoteId,
            propertyId: defaultPropertyId,
            title: defaultTitle || (isConsultation ? 'Consultation' : undefined),
            purpose: isConsultation ? 'consultation' : 'service',
          }}
        />
      </Card>
    </>
  );
}
