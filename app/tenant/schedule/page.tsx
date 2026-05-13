import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { Tables } from '@/lib/supabase/database.types';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import {
  dbOverlapRangeForQuery,
  isLocalCalendarToday,
  normalizeDateKey,
  normalizeView,
  utcWeekDayKeys,
} from '@/lib/tenant/scheduleDateRange';
import { TenantScheduleClient, type ScheduleVisitVM } from './TenantScheduleClient';
import styles from './schedule.module.scss';

export const dynamic = 'force-dynamic';

type VisitListRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: Tables<'tenant_scheduled_visits'>['status'];
  notes: string | null;
  customers: { customer_identities: { full_name: string | null; phone: string | null } | null } | null;
  tenant_customer_properties:
    | Pick<
        Tables<'tenant_customer_properties'>,
        'label' | 'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code'
      >
    | null;
  tenant_quotes: { title: string } | null;
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TenantSchedulePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const dateKey = normalizeDateKey(sp.date);
  const view = normalizeView(sp.view);
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', '/schedule');

  const supabase = createTenantPortalDbClient();
  const range = dbOverlapRangeForQuery(view, dateKey);

  const { data: visitRows, error: visitsErr } = await supabase
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
          full_name,
          phone
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
    .lte('starts_at', range.end)
    .gte('ends_at', range.start)
    .order('starts_at', { ascending: true })
    .overrideTypes<VisitListRow[], { merge: false }>();

  if (visitsErr) {
    throw new Error(visitsErr.message);
  }

  const visits: ScheduleVisitVM[] = (visitRows ?? []).map((v) => {
    const ident = v.customers?.customer_identities;
    const who = ident?.full_name?.trim() || 'Customer';
    const prop = v.tenant_customer_properties;
    const site = prop ? [prop.label?.trim(), formatPropertyAddressLine(prop)].filter(Boolean).join(' — ') : '';
    return {
      id: v.id,
      title: v.title,
      starts_at: v.starts_at,
      ends_at: v.ends_at,
      status: v.status,
      notes: v.notes,
      customerName: who,
      customerPhone: ident?.phone?.trim() || null,
      siteLine: site,
      quoteTitle: v.tenant_quotes?.title ?? null,
    };
  });

  const weekDayKeys = utcWeekDayKeys(dateKey);
  const subtitle =
    view === 'day' && isLocalCalendarToday(dateKey)
      ? "Today's appointments"
      : view === 'day'
        ? 'Day view — appointments on the timeline below.'
        : view === 'week'
          ? 'Week view — scan the crew grid at a glance.'
          : 'Month view — tap a day to open the day timeline.';

  return (
    <>
      <PageHeader
        title="Schedule"
        description={subtitle}
        actions={
          <Button as="a" href="/schedule/new" variant="primary" iconLeft={<Plus size={18} aria-hidden />}>
            New appointment
          </Button>
        }
      />

      <Card title="Calendar" description="Switch day, week, or month. Filters apply to the whole team when wired up.">
        <TenantScheduleClient
          tenantSlug={membership.tenantSlug}
          visits={visits}
          dateKey={dateKey}
          view={view}
          weekDayKeys={weekDayKeys}
        />
      </Card>

      <p className={styles.pageFooterHint}>
        Need to block time?{' '}
        <Link href="/schedule/new" className={styles.inlineLink}>
          Add an appointment
        </Link>
        .
      </p>
    </>
  );
}
