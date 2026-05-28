import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { LocationsPanel } from './LocationsPanel';
import styles from '../settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantLocationsSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/locations');
  const canEdit = canManageTeamInvitesAndRoles(membership.role);
  const admin = createAdminClient();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  const locationsEnabled = isFeatureEnabled(tier, 'multiLocationControls');

  const locations = locationsEnabled
    ? ((
        await admin
          .from('tenant_locations')
          .select('id, name, code, is_active')
          .eq('tenant_id', membership.tenantId)
          .order('name')
      ).data ?? [])
    : [];

  return (
    <>
      <PageHeader
        title="Locations"
        titleHint="Tag visits and invoices by branch or territory (Pro)."
        backHref="/settings"
        backLabel="Settings"
      />

      {!canEdit ? (
        <p className={styles.readOnlyNotice} role="status">
          You can view locations here. Only owners and admins can make changes.
        </p>
      ) : null}

      {!locationsEnabled ? (
        <FeatureUpgradePanel
          title="Upgrade to unlock multi-location controls"
          description="Pro lets you organize crews and reporting by branch or territory, with schedule filtering by location."
        />
      ) : null}

      <Card
        title="Branches & territories"
        description="Optional location tags for schedule filtering and future per-location reporting."
      >
        {locationsEnabled ? (
          <LocationsPanel
            tenantSlug={membership.tenantSlug}
            canEdit={canEdit}
            locations={locations}
          />
        ) : (
          <p className={styles.opsIntro}>
            Schedule, invoices, and reports stay workspace-wide on Starter and Business.
          </p>
        )}
      </Card>
    </>
  );
}
