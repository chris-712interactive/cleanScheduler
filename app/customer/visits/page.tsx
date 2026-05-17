import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScheduleAssigneeAvatars } from '@/components/schedule/ScheduleAssigneeAvatars';
import { Button } from '@/components/ui/Button';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { normalizeAssigneeRows } from '@/lib/schedule/mapAssigneeChips';
import { createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getCustomerPendingRescheduleVisitIds } from '@/lib/customer/pendingRescheduleVisits';
import { formatVisitWhenCompact } from '@/lib/datetime/formatInTimeZone';
import styles from './visits.module.scss';

export const dynamic = 'force-dynamic';

function canCustomerRequestReschedule(row: {
  status: string;
  starts_at: string;
  checked_in_at: string | null;
}): boolean {
  if (row.status !== 'scheduled') return false;
  if (row.checked_in_at) return false;
  return new Date(row.starts_at).getTime() >= Date.now();
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function CustomerVisitsPage({ searchParams }: PageProps) {
  const rescheduleSent = firstParam((await searchParams).reschedule) === 'sent';

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
            checked_in_at,
            tenants:tenants!inner ( name, slug, timezone ),
            tenant_scheduled_visit_assignees (
              user_id,
              user_profiles (
                display_name,
                avatar_url
              )
            )
          `,
          )
          .in('customer_id', ctx.customerIds)
          .gte('starts_at', nowIso)
          .order('starts_at', { ascending: true })
      : { data: [], error: null };

  const pendingRescheduleVisitIds = await getCustomerPendingRescheduleVisitIds(ctx.customerIds);

  return (
    <>
      <PageHeader
        title="Upcoming visits"
        description="Every scheduled cleaning you have on file with connected providers."
      />

      {rescheduleSent ? (
        <p className={styles.bannerOk} role="status">
          Reschedule request sent. Your provider will follow up soon.
        </p>
      ) : null}

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
            const t = row.tenants as { name: string; slug: string; timezone: string } | null;
            const assignees = normalizeAssigneeRows(
              row.tenant_scheduled_visit_assignees as Parameters<typeof normalizeAssigneeRows>[0],
            );
            const reschedulePending = pendingRescheduleVisitIds.has(row.id);

            return (
              <Card
                key={row.id}
                title={row.title || 'Visit'}
                description={t?.name ?? 'Provider'}
                actions={
                  assignees.length > 0 ? (
                    <div className={styles.headerCrew}>
                      <span className={styles.crewLabel}>Your crew</span>
                      <ScheduleAssigneeAvatars assignees={assignees} size="lg" />
                    </div>
                  ) : undefined
                }
              >
                {reschedulePending ? (
                  <p className={styles.reschedulePendingBanner} role="status">
                    <StatusPill tone="warning">Reschedule requested</StatusPill>
                    <span>Your provider is reviewing a new time for this visit.</span>
                  </p>
                ) : null}
                <div className={styles.row}>
                  <StatusPill tone="info">
                    {formatVisitWhenCompact(row.starts_at, row.ends_at, t?.timezone)}
                  </StatusPill>
                  <StatusPill tone="neutral">{row.status}</StatusPill>
                  {canCustomerRequestReschedule(row) && !reschedulePending ? (
                    <Button variant="secondary" size="sm" as="a" href={`/visits/reschedule?visit=${row.id}`}>
                      Request reschedule
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </Stack>
      )}
    </>
  );
}
