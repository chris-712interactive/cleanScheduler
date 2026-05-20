import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assertFeatureEnabled,
  assertLimitNotExceeded,
  resolveTenantPlanTier,
} from '@/lib/billing/entitlements';
import type { PlatformPlanTier } from '@/lib/billing/platformPlanTier';
import type { Database } from '@/lib/supabase/database.types';

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function resolveTenantCampaignTier(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<PlatformPlanTier> {
  return resolveTenantPlanTier(admin, tenantId);
}

export async function countCampaignDrafts(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<number> {
  const { count } = await admin
    .from('tenant_email_campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'draft');
  return count ?? 0;
}

export async function countActiveCampaigns(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<number> {
  const { count } = await admin
    .from('tenant_email_campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'sending');
  return count ?? 0;
}

export async function countMarketingSendsThisMonth(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<number> {
  const { data } = await admin
    .from('tenant_email_campaigns')
    .select('sent_count')
    .eq('tenant_id', tenantId)
    .eq('status', 'sent')
    .gte('sent_at', monthStartIso());

  return (data ?? []).reduce((sum, row) => sum + (row.sent_count ?? 0), 0);
}

export function assertCampaignFeatureEnabled(tier: PlatformPlanTier): void {
  assertFeatureEnabled(tier, 'campaigns');
}

export async function assertCanSendCampaign(params: {
  admin: SupabaseClient<Database>;
  tenantId: string;
  recipientCount: number;
}): Promise<PlatformPlanTier> {
  const tier = await resolveTenantCampaignTier(params.admin, params.tenantId);
  assertCampaignFeatureEnabled(tier);

  const [sendsThisMonth, activeCampaigns] = await Promise.all([
    countMarketingSendsThisMonth(params.admin, params.tenantId),
    countActiveCampaigns(params.admin, params.tenantId),
  ]);

  assertLimitNotExceeded(tier, 'maxConcurrentActiveCampaigns', activeCampaigns);
  assertLimitNotExceeded(tier, 'maxCampaignAudienceSize', params.recipientCount);
  assertLimitNotExceeded(
    tier,
    'maxCampaignSendsMonthly',
    sendsThisMonth + params.recipientCount,
  );
  assertLimitNotExceeded(
    tier,
    'includedEmailCreditsMonthly',
    sendsThisMonth + params.recipientCount,
  );

  return tier;
}

export async function assertCanCreateCampaignDraft(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<void> {
  const tier = await resolveTenantCampaignTier(admin, tenantId);
  assertCampaignFeatureEnabled(tier);
  const draftCount = await countCampaignDrafts(admin, tenantId);
  assertLimitNotExceeded(tier, 'maxCampaignDrafts', draftCount);
}
