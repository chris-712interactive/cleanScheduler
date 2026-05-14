import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import styles from './visits.module.scss';

export const dynamic = 'force-dynamic';

function formatWhen(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '—';
  return `${s.toLocaleString()} – ${e.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

export default async function CustomerVisitsPage() {
  const auth = await requirePortalAccess('customer', '/visits');
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx) redirect('/access-denied?reason=no_customer_profile');

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: visits, error } =
    ctx.customerIds.length > 0
      ? await admin
          .from('tenant_scheduled_visits')
          .select(
            `
            id,
            title,
            starts_at,
            ends_at,
            status,
            tenants:tenants!inner ( name, slug )
          `,
          )
          .in('customer_id', ctx.customerIds)
          .gte('starts_at', nowIso)
          .order('starts_at', { ascending: true })
      : { data: [], error: null };

  return (
    <>
      <PageHeader
        title="Upcoming visits"
        description="Every scheduled cleaning you have on file with connected providers."
      />

      {error ? (
        <Card title="Could not load visits">
          <p className={styles.muted}>{error.message}</p>
        </Card>
      ) : !visits?.length ? (
        <EmptyState
          title="No upcoming visits"
          description={
            ctx.links.length === 0
              ? 'Ask your cleaning company to link your customer record to this login.'
              : 'When your provider schedules work for you, it shows up here automatically.'
          }
        />
      ) : (
        <Stack gap={3}>
          {visits.map((row) => {
            const t = row.tenants as { name: string; slug: string } | null;
            return (
              <Card key={row.id} title={row.title || 'Visit'} description={t?.name ?? 'Provider'}>
                <div className={styles.row}>
                  <StatusPill tone="info">{formatWhen(row.starts_at, row.ends_at)}</StatusPill>
                  <StatusPill tone="neutral">{row.status}</StatusPill>
                </div>
                <p className={styles.hint}>
                  Reschedule requests and crew details will appear here as those features go live.
                </p>
              </Card>
            );
          })}
        </Stack>
      )}
    </>
  );
}
