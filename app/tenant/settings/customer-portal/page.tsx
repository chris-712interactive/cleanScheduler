import { Globe } from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import {
  getEntitlementsForTier,
  isFeatureEnabled,
  resolveTenantPlanTier,
} from '@/lib/billing/entitlements';
import {
  canUsePaidSubscriptionFeatures,
  type TenantBillingStatus,
} from '@/lib/billing/tenantSubscriptionAccess';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { customerPortalCnameTarget } from '@/lib/portal/customerPortalHostname';
import { publicEnv } from '@/lib/env';
import { SettingsSectionCard } from '../SettingsSectionCard';
import { CustomerPortalDomainPanel } from './CustomerPortalDomainPanel';
import styles from '../settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantCustomerPortalSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/customer-portal');
  const canEdit = canManageTeamInvitesAndRoles(membership.role);
  const admin = createAdminClient();

  const [{ data: billing }, tier, { data: domainRow }] = await Promise.all([
    admin
      .from('tenant_billing_accounts')
      .select('status')
      .eq('tenant_id', membership.tenantId)
      .maybeSingle(),
    resolveTenantPlanTier(admin, membership.tenantId),
    admin
      .from('tenant_customer_portal_domains')
      .select('hostname, status, verification_token, verified_at')
      .eq('tenant_id', membership.tenantId)
      .maybeSingle(),
  ]);

  const tierEnabled = isFeatureEnabled(tier, 'whiteLabelCustomerPortal');
  const billingStatus = (billing?.status ?? 'trialing') as TenantBillingStatus;
  const paid = canUsePaidSubscriptionFeatures(billingStatus);
  const whiteLabelAllowed = tierEnabled && paid;
  const cnameTarget = customerPortalCnameTarget(publicEnv.NEXT_PUBLIC_APP_DOMAIN);

  const domain =
    domainRow?.hostname && (domainRow.status === 'pending' || domainRow.status === 'active')
      ? {
          hostname: domainRow.hostname,
          status: domainRow.status as 'pending' | 'active',
          verificationToken: domainRow.verification_token,
          verifiedAt: domainRow.verified_at,
        }
      : null;

  return (
    <>
      <PageHeader
        title="Customer portal"
        titleHint="White-label your customer portal with a custom domain (Pro)."
        backHref="/settings"
        backLabel="Settings"
      />

      {!canEdit ? (
        <p className={styles.readOnlyNotice} role="status">
          You can view customer portal settings here. Only owners and admins can make changes.
        </p>
      ) : null}

      {!tierEnabled ? (
        <FeatureUpgradePanel
          title="Upgrade to unlock white-label portal"
          description={`Pro includes a custom customer portal domain, tenant branding in the portal shell, and branded invite links. ${getEntitlementsForTier('business').displayName} includes the shared my.* portal.`}
        />
      ) : !paid ? (
        <p className={styles.opsIntro} style={{ marginBottom: 'var(--space-4)' }} role="status">
          White-label portal is included with Pro after you subscribe. Add a payment method from
          Workspace billing to configure a custom domain during your trial.
        </p>
      ) : null}

      <SettingsSectionCard
        icon={Globe}
        title="Custom domain"
        description="Serve the customer portal on your own hostname with your logo and business name."
      >
        {whiteLabelAllowed ? (
          <CustomerPortalDomainPanel
            tenantSlug={membership.tenantSlug}
            canEdit={canEdit}
            cnameTarget={cnameTarget}
            domain={domain}
          />
        ) : (
          <p className={styles.opsIntro}>
            Available on Pro with an active subscription. Customers on Business continue to use the
            shared customer portal at <code>{cnameTarget}</code>.
          </p>
        )}
      </SettingsSectionCard>
    </>
  );
}
