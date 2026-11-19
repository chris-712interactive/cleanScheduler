import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Button } from '@/components/ui/Button';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { TenantRole } from '@/lib/auth/types';
import { DEFAULT_TENANT_TIMEZONE } from '@/lib/datetime/formatInTimeZone';
import { getPortalContext } from '@/lib/portal';
import {
  dayMapStyleNotice,
  formatDayMapDateLabel,
  resolveDayMapStyleUrl,
} from '@/lib/schedule/dayMap';
import { loadDayMap } from '@/lib/schedule/loadDayMap';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { isFieldEmployeeRole } from '@/lib/tenant/fieldEmployeeAccess';
import {
  hasPermission,
  resolveMembershipPermissions,
} from '@/lib/tenant/resolveMembershipPermissions';
import { normalizeDateKey, shiftDateKey } from '@/lib/tenant/scheduleDateRange';
import { DayMap } from './DayMap';
import styles from './dayMap.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DayMapPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', '/schedule/map');
  if (isFieldEmployeeRole(membership.role as TenantRole)) {
    redirect('/schedule');
  }

  const supabase = createTenantPortalDbClient();
  const permissions = await resolveMembershipPermissions(supabase, membership);
  if (!hasPermission(permissions, 'schedule.view')) {
    redirect('/');
  }

  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('timezone')
    .eq('id', membership.tenantId)
    .maybeSingle();
  const timeZone = tenantRow?.timezone?.trim() || DEFAULT_TENANT_TIMEZONE;
  const dateKey = normalizeDateKey(sp.date);
  const model = await loadDayMap({
    supabase,
    tenantId: membership.tenantId,
    dateKey,
    timeZone,
  });
  const styleUrl = resolveDayMapStyleUrl(process.env.NEXT_PUBLIC_MAP_STYLE_URL);
  const previousDay = shiftDateKey(dateKey, -1);
  const nextDay = shiftDateKey(dateKey, 1);
  const scheduleHref = `/schedule?date=${dateKey}&view=day`;

  return (
    <div className={styles.page}>
      <PageHeader
        title="Day map"
        description={`${formatDayMapDateLabel(dateKey)}. Pins show the visits that have a map point, colored by the assigned cleaner.`}
        backHref={scheduleHref}
        backLabel="Schedule"
        actions={
          <Button as="a" href={scheduleHref} variant="secondary">
            Schedule
          </Button>
        }
      />

      <form className={styles.picker} action="/schedule/map" method="get">
        <Link className={styles.pickerLink} href={`/schedule/map?date=${previousDay}`}>
          Previous day
        </Link>
        <label className={styles.pickerField}>
          <span className={styles.pickerLabel}>Day</span>
          <input
            className={styles.pickerInput}
            type="date"
            name="date"
            defaultValue={dateKey}
            required
          />
        </label>
        <Button type="submit" variant="secondary">
          Show day
        </Button>
        <Link className={styles.pickerLink} href={`/schedule/map?date=${nextDay}`}>
          Next day
        </Link>
      </form>

      <div className={styles.layout}>
        <div className={styles.mapColumn}>
          <DayMap styleUrl={styleUrl} pins={model.pins} />
          <p className={styles.notice}>{dayMapStyleNotice(styleUrl)}</p>
        </div>

        <aside className={styles.side} aria-label="Day map details">
          <section>
            <h2 className={styles.sideTitle}>Cleaners</h2>
            {model.groups.length === 0 ? (
              <p className={styles.sideEmpty}>No visits on the map.</p>
            ) : (
              <ul className={styles.legend}>
                {model.groups.map((group) => (
                  <li key={group.id} className={styles.legendItem}>
                    <span
                      className={styles.swatch}
                      style={{ backgroundColor: group.color }}
                      aria-hidden
                    />
                    <span>{group.label}</span>
                    <span className={styles.legendCount}>{group.visitCount}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className={styles.sideTitle}>Visits on the map</h2>
            {model.pins.length === 0 ? (
              <p className={styles.sideEmpty}>No visits with a map point this day.</p>
            ) : (
              <ul className={styles.visitList}>
                {model.pins.map((pin) => (
                  <li key={pin.visitId} className={styles.visitItem}>
                    <a href={pin.href}>{pin.customerName}</a>
                    <p>{pin.timeLabel}</p>
                    <p>{pin.assigneeLabel === 'Unassigned' ? 'Unassigned' : pin.assigneeLabel}</p>
                    {pin.status === 'completed' ? <p>Completed</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className={styles.sideTitle}>Needs a map point</h2>
            {model.missing.length === 0 ? (
              <p className={styles.sideEmpty}>Every visit on this day has a point.</p>
            ) : (
              <ul className={styles.visitList}>
                {model.missing.map((item) => (
                  <li key={item.visitId} className={styles.visitItem}>
                    <a href={item.href}>{item.customerName}</a>
                    <p>{item.timeLabel}</p>
                    {item.siteLine ? <p>{item.siteLine}</p> : null}
                    <p className={styles.reason}>{item.reasonLabel}</p>
                    {item.customerHref ? <a href={item.customerHref}>Fix the address</a> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
