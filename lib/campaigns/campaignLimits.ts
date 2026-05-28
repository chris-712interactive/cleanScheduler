import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assertFeatureEnabled,
  assertLimitNotExceeded,
  resolveTenantEntitlementPlan,
  type EntitlementPlanKey,
} from '@/lib/billing/entitlements';
import type { Database } from '@/lib/supabase/database.types';

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function resolveTenantCampaignPlan(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<EntitlementPlanKey> {
  return resolveTenantEntitlementPlan(admin, tenantId);
}

/** @deprecated Use {@link resolveTenantCampaignPlan} */
export async function resolveTenantCampaignTier(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<EntitlementPlanKey> {
  return resolveTenantCampaignPlan(admin, tenantId);
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

export function assertCampaignFeatureEnabled(plan: EntitlementPlanKey): void {
  assertFeatureEnabled(plan, 'campaigns');
}

export async function assertCanSendCampaign(params: {
  admin: SupabaseClient<Database>;
  tenantId: string;
  recipientCount: number;
}): Promise<EntitlementPlanKey> {
  const plan = await resolveTenantCampaignPlan(params.admin, params.tenantId);
  assertCampaignFeatureEnabled(plan);

  const [sendsThisMonth, activeCampaigns] = await Promise.all([
    countMarketingSendsThisMonth(params.admin, params.tenantId),
    countActiveCampaigns(params.admin, params.tenantId),
  ]);

  assertLimitNotExceeded(plan, 'maxConcurrentActiveCampaigns', activeCampaigns);
  assertLimitNotExceeded(plan, 'maxCampaignAudienceSize', params.recipientCount);
  assertLimitNotExceeded(plan, 'maxCampaignSendsMonthly', sendsThisMonth + params.recipientCount);
  assertLimitNotExceeded(
    plan,
    'includedEmailCreditsMonthly',
    sendsThisMonth + params.recipientCount,
  );

  return plan;
}

export async function assertCanCreateCampaignDraft(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<void> {
  const plan = await resolveTenantCampaignPlan(admin, tenantId);
  assertCampaignFeatureEnabled(plan);
  const draftCount = await countCampaignDrafts(admin, tenantId);
  assertLimitNotExceeded(plan, 'maxCampaignDrafts', draftCount);
}
