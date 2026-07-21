import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { ServiceZonesPanel } from './ServiceZonesPanel';
import styles from './service-zones-settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantServiceZonesSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/service-zones');
  const canEdit = canManageTeamInvitesAndRoles(membership.role);
  const admin = createAdminClient();

  const zones =
    (
      await admin
        .from('tenant_service_zones')
        .select('id, name, is_active, sort_order')
        .eq('tenant_id', membership.tenantId)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })
    ).data ?? [];

  return (
    <>
      <PageHeader
        title="Service zones"
        titleHint="Communities and areas for organizing customer locations."
        backHref="/settings"
        backLabel="Settings"
      />

      <Stack gap={6}>
        {!canEdit ? (
          <p className={styles.readOnlyNotice} role="status">
            You can view service zones here. Only owners and admins can make changes.
          </p>
        ) : null}

        <ServiceZonesPanel tenantSlug={membership.tenantSlug} canEdit={canEdit} zones={zones} />
      </Stack>
    </>
  );
}
