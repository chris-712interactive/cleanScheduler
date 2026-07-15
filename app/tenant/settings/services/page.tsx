import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { loadJobTypeCatalog } from '@/lib/tenant/jobTypeCatalog';
import { ServiceTypesPanel } from './ServiceTypesPanel';
import styles from './services-settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantServicesSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/services');
  const canEdit = canManageTeamInvitesAndRoles(membership.role);
  const admin = createAdminClient();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  const customTypesEnabled = isFeatureEnabled(tier, 'customServiceTypes');
  const checklistsEnabled = isFeatureEnabled(tier, 'visitChecklists');
  const entries = await loadJobTypeCatalog(admin, membership.tenantId, { activeOnly: true });

  return (
    <>
      <PageHeader
        title="Service types & durations"
        titleHint="Default visit lengths and crew checklists used when scheduling work."
        backHref="/settings"
        backLabel="Settings"
      />

      <Stack gap={6}>
        {!canEdit ? (
          <p className={styles.readOnlyNotice} role="status">
            You can view service types here. Only owners and admins can make changes.
          </p>
        ) : null}

        <ServiceTypesPanel
          tenantSlug={membership.tenantSlug}
          canEdit={canEdit}
          entries={entries}
          customTypesEnabled={customTypesEnabled}
          checklistsEnabled={checklistsEnabled}
        />
      </Stack>
    </>
  );
}
