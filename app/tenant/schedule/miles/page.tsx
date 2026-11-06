import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { TenantRole } from '@/lib/auth/types';
import { isWorkDate, loadMileageDay } from '@/lib/mileage/store';
import { getPortalContext } from '@/lib/portal';
import { createAdminClient } from '@/lib/supabase/server';
import { calendarDateKeyInTimeZone } from '@/lib/datetime/tenantCalendarDay';
import { shiftDateKey } from '@/lib/tenant/scheduleDateRange';
import {
  hasPermission,
  resolveMembershipPermissions,
} from '@/lib/tenant/resolveMembershipPermissions';
import { MileageDayForm } from '../MileageDayForm';
import { Button } from '@/components/ui/Button';
import styles from '../mileage.module.scss';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function MileageDayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/schedule/miles');
  const auth = await getAuthContext();
  const actorId = auth?.user.id ?? '';
  const admin = createAdminClient();
  const { data: tenant } = await admin
    .from('tenants')
    .select('timezone')
    .eq('id', membership.tenantId)
    .maybeSingle();
  const timeZone = tenant?.timezone ?? 'America/New_York';
  const requestedDate = typeof sp.date === 'string' ? sp.date : '';
  const workDate = isWorkDate(requestedDate) ? requestedDate : calendarDateKeyInTimeZone(timeZone);
  const requestedUser = typeof sp.user === 'string' ? sp.user : '';
  const permissions = await resolveMembershipPermissions(admin, membership);
  const role = membership.role as TenantRole;
  const canReview =
    role === 'owner' || role === 'admin' || hasPermission(permissions, 'mileage.review');
  const userId = UUID_RE.test(requestedUser) && canReview ? requestedUser : actorId;
  if (!userId) notFound();

  const day = await loadMileageDay({
    admin,
    tenantId: membership.tenantId,
    userId,
    workDate,
    timeZone,
    rebuild: sp.rebuild === '1',
  });
  const prev = shiftDateKey(workDate, -1);
  const next = shiftDateKey(workDate, 1);
  const userQuery = userId === actorId ? '' : `&user=${userId}`;
  const yearDefault = workDate.slice(0, 4);

  return (
    <>
      <PageHeader
        title="Review miles"
        titleHint="Confirm the drives for this day. A blank mile can be typed, or opened in Maps."
        backHref="/schedule"
        backLabel="Schedule"
      />
      <div className={styles.stack}>
        <p className={styles.lead}>
          <Link href={`/schedule/miles?date=${prev}${userQuery}`}>Previous day</Link>
          {' · '}
          <Link href={`/schedule/miles?date=${next}${userQuery}`}>Next day</Link>
          {canReview ? (
            <>
              {' · '}
              <Link href="/mileage">Team week</Link>
            </>
          ) : null}
        </p>
        <form id="year-file" className={styles.summary} action="/schedule/miles/year" method="get">
          <p className={styles.legTitle}>Year file</p>
          <p className={styles.meta}>
            {userId === actorId
              ? 'Download your confirmed drives for a calendar year. Each line is one drive, with the odometer when it was entered. Drives left off the company pay rules are included.'
              : `Download ${day.personName}'s confirmed drives for a calendar year. Each line is one drive, with the odometer when it was entered.`}
          </p>
          {userId === actorId ? null : <input type="hidden" name="user" value={userId} />}
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Calendar year</span>
              <input
                className={styles.input}
                name="year"
                type="number"
                min={2000}
                max={2100}
                defaultValue={yearDefault}
                required
              />
            </label>
          </div>
          <div className={styles.actions}>
            <Button type="submit" name="format" value="csv" variant="secondary" size="sm">
              CSV
            </Button>
            <Button type="submit" name="format" value="pdf" variant="secondary" size="sm">
              PDF
            </Button>
          </div>
        </form>
        <MileageDayForm
          tenantSlug={membership.tenantSlug}
          userId={userId}
          workDate={workDate}
          personName={day.personName}
          status={day.status}
          vehicle={day.vehicle}
          odometerStart={day.odometerStart}
          odometerEnd={day.odometerEnd}
          legs={day.legs}
          places={day.places}
          settings={day.settings}
          locked={day.locked}
          timeZone={timeZone}
        />
      </div>
    </>
  );
}
