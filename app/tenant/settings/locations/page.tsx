import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { LocationsPanel } from './LocationsPanel';
import styles from './locations-settings.module.scss';

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
        titleHint="Tag visits and invoices by branch or territory."
        backHref="/settings"
        backLabel="Settings"
      />

      <Stack gap={6}>
        {!canEdit ? (
          <p className={styles.readOnlyNotice} role="status">
            You can view locations here. Only owners and admins can make changes.
          </p>
        ) : null}

        {!locationsEnabled ? (
          <>
            <FeatureUpgradePanel
              title="Upgrade to unlock multi-location controls"
              description="Pro lets you organize crews and reporting by branch or territory, with schedule filtering by location."
            />
            <div className={styles.lockedSection}>
              <header className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>What locations are for</h2>
                <p className={styles.lockedLead}>
                  When unlocked, you can tag visits and invoices by crew or service area and filter
                  the schedule by location.
                </p>
              </header>
            </div>
          </>
        ) : (
          <LocationsPanel
            tenantSlug={membership.tenantSlug}
            canEdit={canEdit}
            locations={locations}
          />
        )}
      </Stack>
    </>
  );
}
