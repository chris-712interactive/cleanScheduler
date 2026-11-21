import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Button } from '@/components/ui/Button';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  featureUpgradeMessage,
  isFeatureEnabled,
  resolveTenantRoutingPlan,
} from '@/lib/billing/entitlements';
import { DEFAULT_TENANT_TIMEZONE } from '@/lib/datetime/formatInTimeZone';
import { todayKey } from '@/lib/mileage/store';
import { getPortalContext } from '@/lib/portal';
import { loadDriveTimeReport } from '@/lib/routing/loadDriveTimeReport';
import { canApplyStopOrder } from '@/lib/routing/locks';
import { driveTimeMilesLabel, driveTimeSourceLabel } from '@/lib/routing/driveTimeReport';
import { createAdminClient } from '@/lib/supabase/server';
import { isCalendarDateKey } from '@/lib/tenant/scheduleDateRange';
import styles from '../stop-order.module.scss';

export const dynamic = 'force-dynamic';

function shiftDate(dateKey: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function minutesLabel(seconds: number): string {
  return `${Math.round(seconds / 60)} min`;
}

export default async function DriveTimeReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', '/schedule/drive-time');
  const admin = createAdminClient();
  const office = canApplyStopOrder(membership.role);

  if (!office) {
    return (
      <>
        <PageHeader title="Drive time" backHref="/schedule" backLabel="Schedule" />
        <section className={styles.panel} aria-label="Drive time">
          <p className={styles.lead}>Only the office can view drive time.</p>
        </section>
      </>
    );
  }

  const plan = await resolveTenantRoutingPlan(admin, membership.tenantId);
  if (!isFeatureEnabled(plan, 'driveTimeReports')) {
    return (
      <>
        <PageHeader title="Drive time" backHref="/schedule" backLabel="Schedule" />
        <section className={styles.panel} aria-label="Drive time">
          <p className={styles.lead}>{featureUpgradeMessage('driveTimeReports')}</p>
        </section>
      </>
    );
  }

  const { data: tenantRow } = await admin
    .from('tenants')
    .select('timezone')
    .eq('id', membership.tenantId)
    .maybeSingle();
  const today = todayKey(tenantRow?.timezone?.trim() || DEFAULT_TENANT_TIMEZONE);
  const fromRaw = typeof sp.from === 'string' ? sp.from : '';
  const toRaw = typeof sp.to === 'string' ? sp.to : '';
  const from = isCalendarDateKey(fromRaw) ? fromRaw : shiftDate(today, -6);
  const to = isCalendarDateKey(toRaw) ? toRaw : today;
  const report = await loadDriveTimeReport({
    supabase: admin,
    tenantId: membership.tenantId,
    from: from <= to ? from : to,
    to: from <= to ? to : from,
  });
  const exportHref = `/schedule/drive-time/export?from=${from <= to ? from : to}&to=${from <= to ? to : from}`;

  return (
    <>
      <PageHeader
        title="Drive time"
        description="Minutes and miles saved when the office applied a route. This report does not call the routing engine."
        backHref="/schedule"
        backLabel="Schedule"
      />
      <form className={styles.panel} action="/schedule/drive-time" method="get">
        <label className={styles.meta}>
          From
          <input type="date" name="from" defaultValue={from <= to ? from : to} aria-label="From" />
        </label>
        <label className={styles.meta}>
          To
          <input type="date" name="to" defaultValue={from <= to ? to : from} aria-label="To" />
        </label>
        <Button type="submit" variant="secondary">
          Show range
        </Button>
        <Link href={exportHref}>Download CSV</Link>
      </form>
      <section className={styles.panel} aria-labelledby="drive-rows-heading">
        <h2 id="drive-rows-heading" className={styles.title}>
          By cleaner and day
        </h2>
        {report.rows.length === 0 ? (
          <p className={styles.lead}>No applied routes in this range.</p>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Cleaner</th>
                  <th>Stops</th>
                  <th>Drive minutes</th>
                  <th>Miles</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={`${row.serviceDate}-${row.cleanerId}`}>
                    <td>{row.serviceDate}</td>
                    <td>{row.cleanerName}</td>
                    <td>{row.stopCount}</td>
                    <td>
                      {row.estimateKind === 'drive' && row.driveSeconds != null
                        ? minutesLabel(row.driveSeconds)
                        : '—'}
                    </td>
                    <td>{driveTimeMilesLabel(row)}</td>
                    <td>{driveTimeSourceLabel(row.estimateKind)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.meta}>
              Engine drive time: {minutesLabel(report.driveSeconds)}, {report.driveMiles.toFixed(1)}{' '}
              drive mi, {report.driveStopCount} stops.
            </p>
            <p className={styles.meta}>
              Straight-line estimate: {report.straightLineStopCount} stops,{' '}
              {report.straightLineMiles.toFixed(1)} mi straight-line estimate. This is not driving
              miles.
            </p>
          </>
        )}
      </section>
    </>
  );
}
