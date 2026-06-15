import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { minimumTierLabelForFeature } from '@/lib/billing/tenantFeatureGate';
import { canUsePaidSubscriptionFeatures } from '@/lib/billing/tenantSubscriptionAccess';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { siteUrlForTenant } from '@/lib/portal/tenantSiteOrigin';
import { ensureTenantMarketingSiteSeeded } from '@/lib/tenantSite/seedTenantSite';
import {
  loadTenantMarketingLeads,
  loadTenantSitePagesForAdmin,
  mapTenantSiteSettings,
} from '@/lib/tenantSite/loadTenantSiteData';
import { WebsiteLeadsPanel } from './WebsiteLeadsPanel';
import { WebsitePageListPanel } from './WebsitePageListPanel';
import { WebsitePublishPanel } from './WebsitePublishPanel';
import styles from './website-settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantWebsiteSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/website');
  const canEdit = canManageTeamInvitesAndRoles(membership.role);
  const admin = createAdminClient();
  const plan = await resolveTenantEntitlementPlan(admin, membership.tenantId);
  const websiteEnabled = isFeatureEnabled(plan, 'tenantMarketingSite');

  if (websiteEnabled) {
    await ensureTenantMarketingSiteSeeded(admin, membership.tenantId);
  }

  const loaded = websiteEnabled
    ? await Promise.all([
        admin
          .from('tenant_marketing_site_settings')
          .select('*')
          .eq('tenant_id', membership.tenantId)
          .maybeSingle(),
        admin
          .from('tenant_billing_accounts')
          .select('status')
          .eq('tenant_id', membership.tenantId)
          .maybeSingle(),
        loadTenantSitePagesForAdmin(admin, membership.tenantId),
        loadTenantMarketingLeads(admin, membership.tenantId),
        siteUrlForTenant(admin, membership.tenantId, '/'),
      ])
    : null;

  const settingsRow = loaded?.[0].data ?? null;
  const billing = loaded?.[1].data ?? null;
  const pages = loaded?.[2] ?? [];
  const leads = loaded?.[3] ?? [];
  const previewUrl = loaded?.[4] ?? '';

  const trialPreview =
    plan === 'trial' || !canUsePaidSubscriptionFeatures(billing?.status ?? 'trialing');

  return (
    <>
      <PageHeader
        title="Website"
        titleHint="Public marketing pages, SEO, and inbound leads for your cleaning business."
        backHref="/settings"
        backLabel="Settings"
        actions={
          websiteEnabled ? (
            <Link href="/settings/website/domain" className={styles.inlineLink}>
              Domain settings
            </Link>
          ) : undefined
        }
      />

      <Stack gap={6}>
        {!canEdit ? (
          <p className={styles.readOnlyNotice} role="status">
            You can view website settings here. Only owners and admins can make changes.
          </p>
        ) : null}

        {!websiteEnabled ? (
          <FeatureUpgradePanel
            title="Upgrade to publish a marketing website"
            description={`Upgrade to ${minimumTierLabelForFeature('tenantMarketingSite')} to create SEO-friendly public pages and capture inbound leads.`}
          />
        ) : settingsRow ? (
          <>
            <WebsitePublishPanel
              tenantSlug={membership.tenantSlug}
              isPublished={settingsRow.is_published}
              previewUrl={previewUrl}
              trialPreview={trialPreview}
              settings={mapTenantSiteSettings(settingsRow)}
            />
            <WebsitePageListPanel
              tenantSlug={membership.tenantSlug}
              pages={pages.map((page) => ({
                id: page.id,
                slug: page.slug,
                pageType: page.page_type,
                status: page.status,
                headline: page.headline,
              }))}
              canCreatePage={canEdit}
            />
            <WebsiteLeadsPanel
              tenantSlug={membership.tenantSlug}
              leads={leads.map((lead) => ({
                id: lead.id,
                name: lead.name,
                email: lead.email,
                phone: lead.phone,
                message: lead.message,
                status: lead.status,
                createdAt: lead.created_at,
              }))}
            />
          </>
        ) : null}
      </Stack>
    </>
  );
}
