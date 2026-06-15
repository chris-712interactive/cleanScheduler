import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { canUsePaidSubscriptionFeatures } from '@/lib/billing/tenantSubscriptionAccess';
import { normalizeCustomerPortalHostname } from '@/lib/portal/customerPortalHostname';
import { whiteLabelHostTag } from '@/lib/portal/cacheTags';
import type { TenantPublicDomainSiteMode } from '@/lib/tenantSite/types';

export interface ActiveWhiteLabelCustomerPortal {
  tenantId: string;
  tenantSlug: string;
  hostname: string;
  siteMode: TenantPublicDomainSiteMode;
}

async function resolveActiveWhiteLabelCustomerPortalUncached(
  rawHost: string,
): Promise<ActiveWhiteLabelCustomerPortal | null> {
  const hostname = normalizeCustomerPortalHostname(rawHost);
  if (!hostname) return null;

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from('tenant_customer_portal_domains')
    .select(
      `
      hostname,
      status,
      site_mode,
      tenants:tenants!inner ( id, slug )
    `,
    )
    .eq('hostname', hostname)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !row) return null;

  const tenant = row.tenants as { id: string; slug: string } | null;
  if (!tenant) return null;

  const [{ data: billing }, tier] = await Promise.all([
    admin.from('tenant_billing_accounts').select('status').eq('tenant_id', tenant.id).maybeSingle(),
    resolveTenantPlanTier(admin, tenant.id),
  ]);

  if (!isFeatureEnabled(tier, 'whiteLabelCustomerPortal')) return null;
  if (!canUsePaidSubscriptionFeatures(billing?.status)) return null;

  return {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    hostname: row.hostname,
    siteMode: (row.site_mode as TenantPublicDomainSiteMode) ?? 'portal_only',
  };
}

/** Resolves an active white-label customer portal host to its tenant (service role). */
export async function resolveActiveWhiteLabelCustomerPortal(
  rawHost: string,
): Promise<ActiveWhiteLabelCustomerPortal | null> {
  const hostname = normalizeCustomerPortalHostname(rawHost);
  if (!hostname) return null;

  return unstable_cache(
    () => resolveActiveWhiteLabelCustomerPortalUncached(rawHost),
    ['white-label-customer-portal', hostname],
    { revalidate: 300, tags: [whiteLabelHostTag(hostname)] },
  )();
}
