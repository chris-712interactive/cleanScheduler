import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { TenantRole } from '@/lib/auth/types';
import { calendarDateKeyInTimeZone } from '@/lib/datetime/tenantCalendarDay';
import { isWorkDate, loadMileageSettings, loadMileageWeek } from '@/lib/mileage/store';
import { addDateKey } from '@/lib/mileage/model';
import { getPortalContext } from '@/lib/portal';
import { createAdminClient } from '@/lib/supabase/server';
import {
  hasPermission,
  resolveMembershipPermissions,
} from '@/lib/tenant/resolveMembershipPermissions';
import { MileageApproveButton } from './MileageApproveButton';
import styles from '../schedule/mileage.module.scss';

export const dynamic = 'force-dynamic';

export default async function MileageWeekPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/mileage');
  const admin = createAdminClient();
  const permissions = await resolveMembershipPermissions(admin, membership);
  const role = membership.role as TenantRole;
  const canReview =
    role === 'owner' || role === 'admin' || hasPermission(permissions, 'mileage.review');
  if (!canReview) {
    return (
      <>
        <PageHeader title="Miles" backHref="/schedule" backLabel="Schedule" />
        <p className={styles.lead}>
          <Link href="/schedule/miles">Review your miles</Link>
        </p>
      </>
    );
  }

  const { data: tenant } = await admin
    .from('tenants')
    .select('timezone')
    .eq('id', membership.tenantId)
    .maybeSingle();
  const timeZone = tenant?.timezone ?? 'America/New_York';
  const requested = typeof sp.date === 'string' ? sp.date : '';
  const anchor = isWorkDate(requested) ? requested : calendarDateKeyInTimeZone(timeZone);
  const [week, settings] = await Promise.all([
    loadMileageWeek({ admin, tenantId: membership.tenantId, anchorDate: anchor }),
    loadMileageSettings(admin, membership.tenantId),
  ]);
  const totalMiles = week.days.reduce((sum, day) => sum + day.countedMiles, 0);
  const totalCents = week.days.reduce((sum, day) => sum + (day.reimbursementCents ?? 0), 0);
  const showAmount = settings.reimbursementEnabled;

  return (
    <>
      <PageHeader
        title="Miles"
        titleHint="Confirmed days can be approved. The CSV stays separate from payroll hours."
        backHref="/schedule"
        backLabel="Schedule"
      />
      <div className={styles.stack}>
        <p className={styles.lead}>
          <Link href={`/mileage?date=${addDateKey(week.weekStart, -7)}`}>Previous week</Link>
          {' · '}
          Week of {week.weekStart}
          {' · '}
          <Link href={`/mileage?date=${addDateKey(week.weekStart, 7)}`}>Next week</Link>
          {' · '}
          <a
            href={`/api/tenant/mileage/export?from=${week.weekStart}&to=${addDateKey(week.weekStart, 6)}`}
          >
            Export CSV
          </a>
        </p>
        <p className={styles.miles}>
          {totalMiles.toFixed(1)} mi
          {showAmount ? ` · $${(totalCents / 100).toFixed(2)}` : ''}
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Person</th>
                <th>Date</th>
                <th>Miles</th>
                {showAmount ? <th>Amount</th> : null}
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {week.days.map((day) => (
                <tr key={day.id}>
                  <td>{day.personName}</td>
                  <td>
                    <Link href={`/schedule/miles?date=${day.workDate}&user=${day.userId}`}>
                      {day.workDate}
                    </Link>
                  </td>
                  <td>{day.countedMiles.toFixed(1)}</td>
                  {showAmount ? (
                    <td>
                      {day.reimbursementCents == null
                        ? '—'
                        : `$${(day.reimbursementCents / 100).toFixed(2)}`}
                    </td>
                  ) : null}
                  <td>{day.status}</td>
                  <td>
                    {day.status === 'confirmed' ? (
                      <MileageApproveButton tenantSlug={membership.tenantSlug} dayId={day.id} />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {week.days.length === 0 ? (
          <p className={styles.lead}>
            No saved days this week. A day appears here after someone saves or confirms it.
          </p>
        ) : null}
      </div>
    </>
  );
}
