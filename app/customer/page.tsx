import { redirect } from 'next/navigation';
import { ArrowRight, Calendar, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Grid } from '@/components/layout/Grid';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function formatVisitRange(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '—';
  const date = s.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const t0 = s.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const t1 = e.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${t0}–${t1}`;
}

export default async function CustomerHomePage() {
  const auth = await requirePortalAccess('customer', '/');
  const ctx = await getCustomerPortalContext(auth.user.id);

  if (!ctx) {
    redirect('/access-denied?reason=no_customer_profile');
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  let nextVisitLabel = 'Nothing scheduled';
  let nextVisitMeta: { key: string; value: string }[] = [
    { key: 'Provider', value: '—' },
    { key: 'When', value: '—' },
    { key: 'Visit', value: '—' },
  ];

  if (ctx.customerIds.length > 0) {
    const { data: visits } = await admin
      .from('tenant_scheduled_visits')
      .select('id, title, starts_at, ends_at, tenant_id, tenants:tenants!inner(name)')
      .in('customer_id', ctx.customerIds)
      .eq('status', 'scheduled')
      .gte('starts_at', nowIso)
      .order('starts_at', { ascending: true })
      .limit(1);

    const v = visits?.[0] as
      | {
          title: string;
          starts_at: string;
          ends_at: string;
          tenants: { name: string } | null;
        }
      | undefined;

    if (v) {
      nextVisitLabel = v.title || 'Scheduled visit';
      const tenantName = v.tenants?.name ?? 'Your provider';
      nextVisitMeta = [
        { key: 'Provider', value: tenantName },
        { key: 'When', value: formatVisitRange(v.starts_at, v.ends_at) },
        { key: 'Visit', value: v.title || 'Cleaning visit' },
      ];
    }
  }

  const tenantCount = ctx.links.length;
  const subtitle =
    tenantCount === 0
      ? 'Link your account to a provider to see visits and invoices here.'
      : `You are connected to ${tenantCount} cleaning ${tenantCount === 1 ? 'business' : 'businesses'}.`;

  return (
    <>
      <PageHeader
        title="Welcome back"
        description="Your visits, invoices, and messages across every provider that uses cleanScheduler."
        actions={
          <Button variant="secondary" as="a" href="/visits" iconRight={<ArrowRight size={16} />}>
            All visits
          </Button>
        }
      />

      <Stack gap={6}>
        <Grid min="280px" gap={4}>
          <Card title="Next visit" description="Earliest upcoming cleaning on your calendar">
            <Stack gap={3}>
              <StatusPill tone="info" icon={<Calendar size={14} />}>
                {nextVisitLabel}
              </StatusPill>
              <KeyValueList items={nextVisitMeta} />
            </Stack>
          </Card>

          <Card title="Open invoices" description="Anything waiting for payment">
            <Stack gap={3}>
              <StatusPill tone="neutral" icon={<FileText size={14} />}>
                {ctx.customerIds.length === 0 ? 'No provider links yet' : 'View the Invoices tab'}
              </StatusPill>
              <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
                After your provider issues an invoice, it appears under Invoices with amount and due
                date.
              </p>
              <Button variant="secondary" size="sm" as="a" href="/invoices">
                Go to invoices
              </Button>
            </Stack>
          </Card>
        </Grid>

        <Card title="About this portal">
          <p style={{ marginTop: 0 }}>{subtitle}</p>
          <p style={{ marginBottom: 0, color: 'var(--color-text-muted)' }}>
            Multiple businesses can share one login. Each visit and invoice is labeled with the
            workspace that created it.
          </p>
        </Card>
      </Stack>
    </>
  );
}
