import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import {
  getEntitlementsForPlan,
  isFeatureEnabled,
  resolveTenantEntitlementPlan,
} from '@/lib/billing/entitlements';
import {
  canUsePaidSubscriptionFeatures,
  type TenantBillingStatus,
} from '@/lib/billing/tenantSubscriptionAccess';
import { countActiveIntegrations } from '@/lib/integrations/integrationLimits';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { IntegrationsPanel } from './IntegrationsPanel';
import styles from './integrations-settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantIntegrationsSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/integrations');
  const canEdit = canManageTeamInvitesAndRoles(membership.role);
  const admin = createAdminClient();

  const [{ data: billing }, tier] = await Promise.all([
    admin
      .from('tenant_billing_accounts')
      .select('status')
      .eq('tenant_id', membership.tenantId)
      .maybeSingle(),
    resolveTenantEntitlementPlan(admin, membership.tenantId),
  ]);

  const apiTierEnabled = isFeatureEnabled(tier, 'fullApiWebhooks');
  const billingStatus = (billing?.status ?? 'trialing') as TenantBillingStatus;
  const apiPaid = canUsePaidSubscriptionFeatures(billingStatus);
  const integrationsAllowed = apiTierEnabled && apiPaid;
  const integrationLimit = getEntitlementsForPlan(tier).limits.includedIntegrations;
  const integrationUsed = integrationsAllowed
    ? await countActiveIntegrations(admin, membership.tenantId)
    : 0;

  const apiKeys = integrationsAllowed
    ? ((
        await admin
          .from('tenant_api_keys')
          .select('id, name, key_prefix, last_used_at, created_at')
          .eq('tenant_id', membership.tenantId)
          .is('revoked_at', null)
          .order('created_at', { ascending: false })
      ).data ?? [])
    : [];

  const webhookEndpoints = integrationsAllowed
    ? ((
        await admin
          .from('tenant_webhook_endpoints')
          .select('id, url, description, signing_secret_prefix, event_types, enabled, created_at')
          .eq('tenant_id', membership.tenantId)
          .order('created_at', { ascending: false })
      ).data ?? [])
    : [];

  const apiBaseUrl = `${getPublicOrigin(null)}/api/v1`;

  return (
    <>
      <PageHeader
        title="Integrations"
        titleHint="Connect Zapier, custom scripts, or your own backend to Clean Scheduler."
        backHref="/settings"
        backLabel="Settings"
      />

      <Stack gap={6}>
        {!apiTierEnabled ? (
          <FeatureUpgradePanel
            title="Upgrade to unlock API & webhooks"
            description="Pro includes a read-only REST API, outbound webhooks, and up to 20 integration connections."
          />
        ) : !apiPaid ? (
          <p className={styles.bannerWarning} role="status">
            API keys and webhooks are included with Pro after you subscribe. Add a payment method
            from Workspace billing to create connections during your trial.
          </p>
        ) : null}

        {integrationsAllowed ? (
          <IntegrationsPanel
            tenantSlug={membership.tenantSlug}
            canEdit={canEdit}
            apiBaseUrl={apiBaseUrl}
            integrationLimit={integrationLimit}
            integrationUsed={integrationUsed}
            apiKeys={apiKeys}
            webhookEndpoints={webhookEndpoints}
          />
        ) : (
          <div className={styles.settingsSection}>
            <header className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>What you get with Pro</h2>
              <p className={styles.sectionLead}>
                Once unlocked, you can create API keys to read workspace data and webhooks to
                receive automatic updates when quotes, visits, or invoices change.
              </p>
            </header>
            <div className={styles.dataGrid}>
              {['Customers', 'Quotes', 'Visits', 'Invoices'].map((label) => (
                <div key={label} className={styles.dataTile}>
                  {label}
                </div>
              ))}
            </div>
            <p className={styles.lockedEndpoints}>
              Available API paths: <code>/api/v1/customers</code>, <code>/api/v1/quotes</code>,{' '}
              <code>/api/v1/visits</code>, <code>/api/v1/invoices</code>.
            </p>
          </div>
        )}
      </Stack>
    </>
  );
}
