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
import {
  featureUpgradeMessage,
  isFeatureEnabled,
  resolveTenantEntitlementPlan,
} from '@/lib/billing/entitlements';
import { loadSavedRouteFingerprint } from '@/lib/routing/appliedRoutes';
import { loadDispatchPlan } from '@/lib/routing/loadDispatchPlan';
import { buildReoptimizeOffer } from '@/lib/routing/reoptimize';
import { canApplyStopOrder } from '@/lib/routing/locks';
import { loadCleanerStopOrder } from '@/lib/routing/loadCleanerStopOrder';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';
import { isFieldEmployeeRole } from '@/lib/tenant/fieldEmployeeAccess';
import {
  hasPermission,
  resolveMembershipPermissions,
} from '@/lib/tenant/resolveMembershipPermissions';
import { normalizeDateKey, shiftDateKey } from '@/lib/tenant/scheduleDateRange';
import { DayMap } from './DayMap';
import { DispatchPanel } from '../DispatchPanel';
import { ReoptimizePanel } from '../ReoptimizePanel';
import { StopOrderPanel } from '../StopOrderPanel';
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

  const entitlementPlan = await resolveTenantEntitlementPlan(
    createAdminClient(),
    membership.tenantId,
  );
  if (!isFeatureEnabled(entitlementPlan, 'dayMap')) {
    return (
      <div className={styles.page}>
        <PageHeader title="Day map" backHref="/schedule" backLabel="Schedule" />
        <p className={styles.notice}>{featureUpgradeMessage('dayMap')}</p>
      </div>
    );
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
  const officeCanRoute = canApplyStopOrder(membership.role);
  const stopOrderEnabled = isFeatureEnabled(entitlementPlan, 'singleCleanerStopOrdering');
  const dispatchEnabled = isFeatureEnabled(entitlementPlan, 'multiCleanerDispatch');
  const reoptimizeEnabled = isFeatureEnabled(entitlementPlan, 'routeReoptimization');
  const dispatchPlan =
    officeCanRoute && dispatchEnabled
      ? await loadDispatchPlan({
          supabase,
          tenantId: membership.tenantId,
          dateKey,
          timeZone,
          plan: entitlementPlan,
        })
      : null;
  const savedRouteFingerprint =
    officeCanRoute && reoptimizeEnabled
      ? await loadSavedRouteFingerprint(createAdminClient(), membership.tenantId, dateKey)
      : null;
  const reoptimizeOffer =
    reoptimizeEnabled && dispatchPlan
      ? buildReoptimizeOffer({
          dateKey,
          fingerprint: dispatchPlan.fingerprint,
          changeFingerprint: dispatchPlan.changeFingerprint,
          savedFingerprint: savedRouteFingerprint,
          hasRouteSequence: dispatchPlan.snapshot.some((row) => row.routeSequence != null),
          plan: dispatchPlan.plan,
          snapshot: dispatchPlan.snapshot,
          fixedVisitIds: dispatchPlan.fixedVisitIds,
          titles: new Map(
            [
              ...dispatchPlan.cleaners.flatMap((cleaner) => cleaner.stops),
              ...dispatchPlan.unassigned,
            ].map((stop) => [stop.id, stop.title]),
          ),
        })
      : null;
  const cleanerRaw = typeof sp.cleaner === 'string' ? sp.cleaner.trim() : '';
  const membersRes = officeCanRoute
    ? await supabase
        .from('tenant_memberships')
        .select('user_id, role')
        .eq('tenant_id', membership.tenantId)
        .eq('is_active', true)
        .order('role', { ascending: true })
    : { data: [] };
  const memberIds = [...new Set((membersRes.data ?? []).map((member) => member.user_id))];
  const { data: memberProfiles } =
    memberIds.length > 0
      ? await supabase
          .from('user_profiles')
          .select('user_id, display_name')
          .in('user_id', memberIds)
      : { data: [] as { user_id: string; display_name: string | null }[] };
  const nameByUserId = new Map(
    (memberProfiles ?? []).map((profile) => [profile.user_id, profile.display_name?.trim() || '']),
  );
  const cleanerOptions = (membersRes.data ?? []).map((member) => ({
    id: member.user_id,
    label: `${nameByUserId.get(member.user_id) || 'Member'} (${member.role})`,
  }));
  const selectedCleaner = cleanerOptions.find((option) => option.id === cleanerRaw) ?? null;
  const stopOrder =
    officeCanRoute && stopOrderEnabled && selectedCleaner
      ? await loadCleanerStopOrder({
          supabase,
          tenantId: membership.tenantId,
          dateKey,
          timeZone,
          cleanerUserId: selectedCleaner.id,
          cleanerName: selectedCleaner.label.replace(/\s+\([^)]*\)$/, ''),
          plan: entitlementPlan,
        })
      : null;
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
            key={dateKey}
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

      {officeCanRoute ? (
        <>
          <form className={styles.picker} action="/schedule/map" method="get">
            <input type="hidden" name="date" value={dateKey} />
            <label className={styles.pickerField}>
              <span className={styles.pickerLabel}>Cleaner</span>
              <select
                className={styles.pickerInput}
                name="cleaner"
                aria-label="Cleaner for stop order"
                defaultValue={selectedCleaner?.id ?? ''}
              >
                <option value="">Choose a cleaner</option>
                {cleanerOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="secondary">
              Show this cleaner
            </Button>
          </form>
          <DispatchPanel
            tenantSlug={membership.tenantSlug}
            proposal={dispatchPlan}
            upgradeMessage={dispatchEnabled ? null : featureUpgradeMessage('multiCleanerDispatch')}
          />
          <ReoptimizePanel
            tenantSlug={membership.tenantSlug}
            offer={reoptimizeOffer}
            upgradeMessage={reoptimizeEnabled ? null : featureUpgradeMessage('routeReoptimization')}
          />
          <StopOrderPanel
            tenantSlug={membership.tenantSlug}
            proposal={stopOrder}
            upgradeMessage={
              stopOrderEnabled ? null : featureUpgradeMessage('singleCleanerStopOrdering')
            }
          />
        </>
      ) : null}

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
