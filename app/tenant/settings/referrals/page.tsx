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
import {
  ensureTenantReferralProgramRow,
  loadTenantReferralProgram,
} from '@/lib/referrals/loadTenantReferralProgram';
import { ReferralProgramPanel } from './ReferralProgramPanel';
import styles from './referrals-settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantReferralsSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/referrals');
  const canEdit = canManageTeamInvitesAndRoles(membership.role);
  const admin = createAdminClient();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  const referralsEnabled = isFeatureEnabled(tier, 'customerReferralProgram');

  await ensureTenantReferralProgramRow(admin, membership.tenantId);
  const program = referralsEnabled
    ? await loadTenantReferralProgram(admin, membership.tenantId)
    : null;
  const promotions = referralsEnabled ? await loadTenantPromotions(admin, membership.tenantId) : [];

  return (
    <>
      <PageHeader
        title="Referral program"
        titleHint="Configure who earns rewards and link promotion templates for referrers and new customers."
        backHref="/settings"
        backLabel="Settings"
      />

      <Stack gap={6}>
        {!canEdit ? (
          <p className={styles.readOnlyNotice} role="status">
            You can view referral settings here. Only owners and admins can make changes.
          </p>
        ) : null}

        {!referralsEnabled ? (
          <FeatureUpgradePanel
            title="Referrals require Business or higher"
            description={`Upgrade to ${minimumTierLabelForFeature('customerReferralProgram')} to run a customer referral program.`}
          />
        ) : program ? (
          <ReferralProgramPanel
            tenantSlug={membership.tenantSlug}
            canEdit={canEdit}
            program={program}
            promotions={promotions}
          />
        ) : null}
      </Stack>
    </>
  );
}
