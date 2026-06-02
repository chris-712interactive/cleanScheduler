import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { formatDateTimeInTimeZone } from '@/lib/datetime/formatInTimeZone';
import { loadTenantTimezone } from '@/lib/schedule/memberScheduleProfile';
import { firstNameFromDisplayName } from '@/lib/profile/displayName';
import { TimeOffReviewRow } from './TimeOffReviewRow';
import styles from '../time-off/timeOff.module.scss';

export const dynamic = 'force-dynamic';

export default async function TimeOffRequestsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(
    tenantSlug ?? '',
    '/schedule/time-off-requests',
  );

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    redirect('/schedule/time-off');
  }

  const admin = createAdminClient();
  const timezone = await loadTenantTimezone(admin, membership.tenantId);

  const { data: rows } = await admin
    .from('tenant_member_time_off')
    .select('id, user_id, starts_at, ends_at, request_note')
    .eq('tenant_id', membership.tenantId)
    .eq('status', 'pending')
    .order('starts_at', { ascending: true });

  const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
  const { data: profiles } =
    userIds.length > 0
      ? await admin.from('user_profiles').select('user_id, display_name').in('user_id', userIds)
      : { data: [] };

  const nameByUser = new Map(
    (profiles ?? []).map((p) => [
      p.user_id,
      firstNameFromDisplayName(p.display_name?.trim() || '') || 'Team member',
    ]),
  );

  return (
    <>
      <PageHeader
        title="Time off requests"
        description="Approve or deny time away before it blocks auto-scheduling."
        backHref="/schedule"
        backLabel="Schedule"
      />
      <Card title="Pending">
        {(rows ?? []).length === 0 ? (
          <p className={styles.rowMeta}>No pending time off requests.</p>
        ) : (
          <ul className={styles.list}>
            {(rows ?? []).map((row) => {
              const windowLabel = `${formatDateTimeInTimeZone(row.starts_at, timezone, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })} – ${formatDateTimeInTimeZone(row.ends_at, timezone, {
                timeStyle: 'short',
              })}`;
              return (
                <TimeOffReviewRow
                  key={row.id}
                  tenantSlug={membership.tenantSlug}
                  requestId={row.id}
                  employeeName={nameByUser.get(row.user_id) ?? 'Team member'}
                  windowLabel={windowLabel}
                  requestNote={row.request_note}
                />
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
