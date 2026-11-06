import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { loadJobTypeCatalog } from '@/lib/tenant/jobTypeCatalog';
import { ServiceTypesPanel } from './ServiceTypesPanel';
import { loadTenantServiceSegment } from '@/lib/tenant/loadTenantServiceSegment';
import { capabilitiesForSegment, propertyKindAllowed } from '@/lib/tenant/serviceSegment';
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
  const [entries, serviceSegment] = await Promise.all([
    loadJobTypeCatalog(admin, membership.tenantId, { activeOnly: true }),
    loadTenantServiceSegment(admin, membership.tenantId),
  ]);
  const capabilities = capabilitiesForSegment(serviceSegment);
  const visibleEntries = entries.filter((entry) =>
    propertyKindAllowed(capabilities, entry.job_type),
  );

  return (
    <>
      <PageHeader
        title="Job types"
        titleHint="Duration, minimum crew, schedule role, and checklists for each property type."
        backHref="/settings"
        backLabel="Settings"
      />

      <Stack gap={6}>
        {!canEdit ? (
          <p className={styles.readOnlyNotice} role="status">
            You can view job types here. Only owners and admins can make changes.
          </p>
        ) : null}

        <ServiceTypesPanel
          tenantSlug={membership.tenantSlug}
          canEdit={canEdit}
          entries={visibleEntries}
          propertyKinds={capabilities.propertyKinds}
          customTypesEnabled={customTypesEnabled}
          checklistsEnabled={checklistsEnabled}
        />
      </Stack>
    </>
  );
}
