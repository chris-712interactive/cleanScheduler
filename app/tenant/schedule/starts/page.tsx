import { PageHeader } from '@/components/portal/PageHeader';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  featureUpgradeMessage,
  isFeatureEnabled,
  resolveTenantEntitlementPlan,
} from '@/lib/billing/entitlements';
import { canApplyStopOrder } from '@/lib/routing/locks';
import { isMissingRelationError } from '@/lib/routing/routeBases';
import { getPortalContext } from '@/lib/portal';
import { createAdminClient } from '@/lib/supabase/server';
import { schedulesVisitKind } from '@/lib/schedule/scheduleEligibility';
import type { TenantRole } from '@/lib/auth/types';
import { RouteStartsEditor } from './RouteStartsEditor';
import styles from '../stop-order.module.scss';

export const dynamic = 'force-dynamic';

export default async function RouteStartsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug ?? '', '/schedule/starts');
  const admin = createAdminClient();
  const office = canApplyStopOrder(membership.role);

  if (!office) {
    return (
      <>
        <PageHeader title="Start locations" backHref="/schedule" backLabel="Schedule" />
        <section className={styles.panel} aria-label="Start locations">
          <p className={styles.lead}>Only the office can set start locations.</p>
        </section>
      </>
    );
  }

  const plan = await resolveTenantEntitlementPlan(admin, membership.tenantId);
  if (!isFeatureEnabled(plan, 'multipleStartLocations')) {
    return (
      <>
        <PageHeader title="Start locations" backHref="/schedule" backLabel="Schedule" />
        <section className={styles.panel} aria-label="Start locations">
          <p className={styles.lead}>{featureUpgradeMessage('multipleStartLocations')}</p>
        </section>
      </>
    );
  }

  const [members, placesResult, homesResult] = await Promise.all([
    admin
      .from('tenant_memberships')
      .select('user_id, role, exclude_from_job_schedule, exclude_from_consultation_schedule')
      .eq('tenant_id', membership.tenantId)
      .eq('is_active', true),
    admin
      .from('tenant_route_locations')
      .select('id, label, latitude, longitude')
      .eq('tenant_id', membership.tenantId)
      .order('label'),
    admin
      .from('tenant_member_scheduling_profiles')
      .select('user_id, home_address_line1, home_city, home_state')
      .eq('tenant_id', membership.tenantId),
  ]);
  if (members.error) throw new Error(members.error.message);
  if (placesResult.error && !isMissingRelationError(placesResult.error)) {
    throw new Error(placesResult.error.message);
  }
  if (homesResult.error) throw new Error(homesResult.error.message);

  const crew = (members.data ?? []).filter((member) =>
    schedulesVisitKind(
      {
        role: member.role as TenantRole,
        excludeFromJobs: member.exclude_from_job_schedule,
        excludeFromConsultations: member.exclude_from_consultation_schedule,
      },
      'service',
    ),
  );
  const ids = crew.map((member) => member.user_id);
  const { data: profiles, error: profileError } =
    ids.length > 0
      ? await admin.from('user_profiles').select('user_id, display_name').in('user_id', ids)
      : { data: [], error: null };
  if (profileError) throw new Error(profileError.message);
  const nameById = new Map(
    (profiles ?? []).map((row) => [row.user_id, row.display_name?.trim() || 'Cleaner']),
  );
  const homeById = new Map(
    (homesResult.data ?? []).map((row) => {
      const line = [row.home_address_line1, row.home_city, row.home_state]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(', ');
      return [row.user_id, line || null] as const;
    }),
  );

  return (
    <>
      <PageHeader
        title="Start locations"
        description="Set more than one place a cleaner can start or finish. Ordering and dispatch use the place you pick."
        backHref="/schedule"
        backLabel="Schedule"
      />
      <RouteStartsEditor
        tenantSlug={membership.tenantSlug}
        places={(placesResult.data ?? []).map((place) => ({
          id: place.id,
          label: place.label,
          located: place.latitude != null && place.longitude != null,
        }))}
        cleaners={crew.map((member) => ({
          id: member.user_id,
          name: nameById.get(member.user_id) || 'Cleaner',
          homeLine: homeById.get(member.user_id) ?? null,
        }))}
      />
    </>
  );
}
