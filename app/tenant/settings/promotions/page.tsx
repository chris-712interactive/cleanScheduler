import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { minimumTierLabelForFeature } from '@/lib/billing/tenantFeatureGate';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { loadTenantPromotions } from '@/lib/promotions/loadTenantPromotions';
import { PromotionsPanel } from './PromotionsPanel';
import styles from './promotions-settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantPromotionsSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/promotions');
  const canEdit = canManageTeamInvitesAndRoles(membership.role);
  const admin = createAdminClient();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  const promotionsEnabled = isFeatureEnabled(tier, 'customerPromotions');
  const entries = promotionsEnabled ? await loadTenantPromotions(admin, membership.tenantId) : [];

  return (
    <>
      <PageHeader
        title="Promotions"
        titleHint="Discount codes and account credit your team can apply for customers."
        backHref="/settings"
        backLabel="Settings"
      />

      <Stack gap={6}>
        {!canEdit ? (
          <p className={styles.readOnlyNotice} role="status">
            You can view promotions here. Only owners and admins can make changes.
          </p>
        ) : null}

        {!promotionsEnabled ? (
          <FeatureUpgradePanel
            title="Promotions require Business or higher"
            description={`Upgrade to ${minimumTierLabelForFeature('customerPromotions')} to create discount codes and customer wallet credits.`}
          />
        ) : (
          <PromotionsPanel tenantSlug={membership.tenantSlug} canEdit={canEdit} entries={entries} />
        )}
      </Stack>
    </>
  );
}
