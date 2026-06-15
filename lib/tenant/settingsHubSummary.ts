import type { StatusTone } from '@/components/ui/StatusPill';
import { getMfaStatus } from '@/lib/auth/mfa';
import { hasMinimumTenantRole } from '@/lib/auth/tenantRoleAccess';
import type { TenantRole } from '@/lib/auth/types';
import {
  canUsePaidSubscriptionFeatures,
  type TenantBillingStatus,
} from '@/lib/billing/tenantSubscriptionAccess';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { countActiveIntegrations } from '@/lib/integrations/integrationLimits';
import type { createAdminClient } from '@/lib/supabase/server';

export type SettingsHubCardStatus = {
  label: string;
  tone: StatusTone;
};

export type SettingsHubCardSummary = {
  href: string;
  status?: SettingsHubCardStatus;
};

type AdminClient = ReturnType<typeof createAdminClient>;

export async function getSettingsHubCardSummaries(options: {
  admin: AdminClient;
  tenantId: string;
  role: TenantRole;
}): Promise<Record<string, SettingsHubCardSummary>> {
  const { admin, tenantId, role } = options;
  const tier = await resolveTenantPlanTier(admin, tenantId);
  const summaries: Record<string, SettingsHubCardSummary> = {};

  const [
    { data: billing },
    { data: portalDomain },
    { data: siteSettings },
    { data: tenantRow },
    mfaStatus,
  ] = await Promise.all([
    admin.from('tenant_billing_accounts').select('status').eq('tenant_id', tenantId).maybeSingle(),
    admin
      .from('tenant_customer_portal_domains')
      .select('status')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    admin
      .from('tenant_marketing_site_settings')
      .select('is_published')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    admin.from('tenants').select('logo_url').eq('id', tenantId).maybeSingle(),
    getMfaStatus(),
  ]);

  const billingStatus = (billing?.status ?? 'trialing') as TenantBillingStatus;
  const paid = canUsePaidSubscriptionFeatures(billingStatus);

  if (!tenantRow?.logo_url) {
    summaries['/settings/business'] = {
      href: '/settings/business',
      status: { label: 'Logo not set', tone: 'neutral' },
    };
  }

  if (hasMinimumTenantRole(role, 'admin') && !mfaStatus.enrolled) {
    summaries['/settings/account'] = {
      href: '/settings/account',
      status: { label: '2FA off', tone: 'warning' },
    };
  } else if (mfaStatus.enrolled) {
    summaries['/settings/account'] = {
      href: '/settings/account',
      status: { label: '2FA on', tone: 'success' },
    };
  }

  if (isFeatureEnabled(tier, 'whiteLabelCustomerPortal') && paid) {
    if (portalDomain?.status === 'active') {
      summaries['/settings/customer-portal'] = {
        href: '/settings/customer-portal',
        status: { label: 'Custom domain live', tone: 'success' },
      };
    } else if (portalDomain?.status === 'pending') {
      summaries['/settings/customer-portal'] = {
        href: '/settings/customer-portal',
        status: { label: 'DNS pending', tone: 'warning' },
      };
    }
  }

  if (isFeatureEnabled(tier, 'tenantMarketingSite')) {
    if (siteSettings?.is_published) {
      summaries['/settings/website'] = {
        href: '/settings/website',
        status: { label: tier === 'trial' ? 'Preview' : 'Live', tone: 'success' },
      };

      const { count } = await admin
        .from('tenant_marketing_leads')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'new');

      const newLeads = count ?? 0;
      summaries['/settings/website/leads'] = {
        href: '/settings/website/leads',
        status:
          newLeads > 0
            ? { label: `${newLeads} new`, tone: 'warning' }
            : { label: 'Inbox', tone: 'neutral' },
      };
    } else if (siteSettings) {
      summaries['/settings/website'] = {
        href: '/settings/website',
        status: { label: 'Draft', tone: 'neutral' },
      };
    } else {
      summaries['/settings/website'] = {
        href: '/settings/website',
        status: { label: 'Not set up', tone: 'neutral' },
      };
    }
  }

  if (isFeatureEnabled(tier, 'fullApiWebhooks') && paid) {
    const integrationUsed = await countActiveIntegrations(admin, tenantId);
    summaries['/settings/integrations'] = {
      href: '/settings/integrations',
      status: {
        label: integrationUsed === 0 ? 'No connections' : `${integrationUsed} connected`,
        tone: integrationUsed === 0 ? 'neutral' : 'info',
      },
    };
  }

  if (isFeatureEnabled(tier, 'multiLocationControls')) {
    const { count } = await admin
      .from('tenant_locations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    const activeCount = count ?? 0;
    summaries['/settings/locations'] = {
      href: '/settings/locations',
      status: {
        label: activeCount === 0 ? 'No locations' : `${activeCount} active`,
        tone: activeCount === 0 ? 'neutral' : 'info',
      },
    };
  }

  if (isFeatureEnabled(tier, 'jobCosting')) {
    const { count } = await admin
      .from('compensation_rules')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    const activeRules = count ?? 0;
    summaries['/settings/compensation'] = {
      href: '/settings/compensation',
      status: {
        label: activeRules === 0 ? 'No rules' : `${activeRules} active rules`,
        tone: activeRules === 0 ? 'neutral' : 'info',
      },
    };
  }

  return summaries;
}
