import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { firstNameFromDisplayName } from '@/lib/profile/displayName';
import { memberDayWindowsFromDbRows } from '@/lib/tenant/memberAvailabilityDays';
import { canReviewEmployeeHours, summarizeHoursChange } from '@/lib/tenant/employeeHoursPolicy';
import type { TenantRole } from '@/lib/auth/types';
import { HoursChangeReviewRow } from './HoursChangeReviewRow';
import styles from '../time-off/timeOff.module.scss';

export const dynamic = 'force-dynamic';

export default async function HoursChangeRequestsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', '/schedule/hours-requests');

  if (!canReviewEmployeeHours(membership.role as TenantRole)) {
    redirect('/schedule');
  }

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('tenant_member_availability_change_requests')
    .select('id, user_id, use_tenant_default')
    .eq('tenant_id', membership.tenantId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: true });

  const requests = rows ?? [];
  const userIds = [...new Set(requests.map((row) => row.user_id))];
  const requestIds = requests.map((row) => row.id);

  const [{ data: profiles }, { data: dayRows }] = await Promise.all([
    userIds.length > 0
      ? admin.from('user_profiles').select('user_id, display_name').in('user_id', userIds)
      : Promise.resolve({ data: [] }),
    requestIds.length > 0
      ? admin
          .from('tenant_member_availability_change_request_days')
          .select('request_id, weekday, starts_at, ends_at')
          .in('request_id', requestIds)
      : Promise.resolve({ data: [] }),
  ]);

  const nameByUser = new Map(
    (profiles ?? []).map((profile) => [
      profile.user_id,
      firstNameFromDisplayName(profile.display_name?.trim() || '') || 'Team member',
    ]),
  );

  return (
    <>
      <PageHeader
        title="Hour changes"
        description="Approve a field employee's new weekly hours before the schedule uses them."
        backHref="/schedule"
        backLabel="Schedule"
      />
      <Card title="Pending">
        {requests.length === 0 ? (
          <p className={styles.rowMeta}>No hour changes waiting for approval.</p>
        ) : (
          <ul className={styles.list}>
            {requests.map((row) => {
              const days = (dayRows ?? []).filter((day) => day.request_id === row.id);
              return (
                <HoursChangeReviewRow
                  key={row.id}
                  tenantSlug={membership.tenantSlug}
                  requestId={row.id}
                  employeeName={nameByUser.get(row.user_id) ?? 'Team member'}
                  summary={summarizeHoursChange({
                    useTenantDefault: row.use_tenant_default,
                    days: memberDayWindowsFromDbRows(days),
                  })}
                />
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
