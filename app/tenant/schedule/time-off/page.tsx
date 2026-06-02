import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/server';
import { formatDateTimeInTimeZone } from '@/lib/datetime/formatInTimeZone';
import { loadTenantTimezone } from '@/lib/schedule/memberScheduleProfile';
import { CancelTimeOffButton, TimeOffRequestForm } from './TimeOffRequestForm';
import styles from './timeOff.module.scss';

export const dynamic = 'force-dynamic';

export default async function TimeOffPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', '/schedule/time-off');
  const auth = await getAuthContext();
  const admin = createAdminClient();
  const timezone = await loadTenantTimezone(admin, membership.tenantId);

  const { data: rows } = await admin
    .from('tenant_member_time_off')
    .select('id, starts_at, ends_at, status, request_note, requested_at')
    .eq('tenant_id', membership.tenantId)
    .eq('user_id', auth?.user.id ?? '')
    .neq('status', 'cancelled')
    .order('starts_at', { ascending: false })
    .limit(20);

  const isAdmin = membership.role === 'owner' || membership.role === 'admin';

  return (
    <>
      <PageHeader
        title="Time off"
        description="Request time away so scheduling and auto-assign skip you when you are off."
        backHref="/schedule"
        backLabel="Schedule"
      />
      <Card title="New request">
        <TimeOffRequestForm tenantSlug={membership.tenantSlug} />
      </Card>
      <Card title="Your requests">
        {(rows ?? []).length === 0 ? (
          <p className={styles.rowMeta}>No time off requests yet.</p>
        ) : (
          <ul className={styles.list}>
            {(rows ?? []).map((row) => (
              <li key={row.id} className={styles.row}>
                <strong>
                  {formatDateTimeInTimeZone(row.starts_at, timezone, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}{' '}
                  –{' '}
                  {formatDateTimeInTimeZone(row.ends_at, timezone, {
                    timeStyle: 'short',
                  })}
                </strong>
                {row.request_note ? <p className={styles.rowMeta}>{row.request_note}</p> : null}
                <span className={styles.status}>{row.status}</span>
                {row.status === 'pending' ? (
                  <div>
                    <CancelTimeOffButton tenantSlug={membership.tenantSlug} requestId={row.id} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {isAdmin ? (
        <p className={styles.rowMeta}>
          <a href="/schedule/time-off-requests">Review pending team requests →</a>
        </p>
      ) : null}
    </>
  );
}
