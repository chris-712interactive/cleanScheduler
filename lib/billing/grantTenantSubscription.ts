import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { recordPlatformAuditEvent } from '@/lib/audit/recordPlatformAuditEvent';
import type { PlatformBillingInterval } from '@/lib/billing/platformPlans';
import type { PlatformPlanTier } from '@/lib/billing/platformPlanTier';

type Admin = SupabaseClient<Database>;

export const TENANT_SUBSCRIPTION_GRANTED_AUDIT = 'tenant.subscription_granted';
export const TENANT_SUBSCRIPTION_GRANT_CLEARED_AUDIT = 'tenant.subscription_grant_cleared';

/** Same length as signup, used when a cleared grant would otherwise land on an ended trial. */
export const RESTORED_TRIAL_DAYS = 7;

export type TenantBillingStatus = Database['public']['Enums']['tenant_billing_status'];

export type ManualGrantBilling = {
  status: TenantBillingStatus;
  stripe_subscription_id: string | null;
  platform_plan: PlatformPlanTier | null;
  billing_interval: PlatformBillingInterval | null;
  trial_ends_at: string | null;
  trial_started_at: string | null;
  activated_at: string | null;
  admin_granted_at: string | null;
  canceled_at: string | null;
};

export function manualSubscriptionGrantBlockReason(
  billing: Pick<ManualGrantBilling, 'stripe_subscription_id'> | null,
): string | null {
  if (!billing) return 'This workspace has no billing record.';
  if (billing.stripe_subscription_id?.trim()) {
    return 'This workspace is billed in Stripe. Change the plan there so the charge and access stay in sync.';
  }
  return null;
}

export function canReturnManualSubscriptionToTrial(
  billing: Pick<ManualGrantBilling, 'status' | 'stripe_subscription_id'> | null,
): boolean {
  if (!billing || billing.stripe_subscription_id?.trim()) return false;
  return billing.status === 'active' || billing.status === 'past_due';
}

/**
 * A canceled Stripe event must not knock a workspace off an admin grant.
 * A live Stripe subscription (active, trialing, or past due) still replaces the grant.
 */
export function shouldPreserveAdminSubscriptionGrant(input: {
  adminGrantedAt: string | null | undefined;
  incomingStatus: TenantBillingStatus;
}): boolean {
  return Boolean(input.adminGrantedAt) && input.incomingStatus === 'canceled';
}

export function restoredTrialEndsAt(currentEndsAt: string | null, now: Date): string {
  const currentMs = currentEndsAt ? new Date(currentEndsAt).getTime() : Number.NaN;
  if (Number.isFinite(currentMs) && currentMs > now.getTime()) {
    return new Date(currentMs).toISOString();
  }
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + RESTORED_TRIAL_DAYS);
  return end.toISOString();
}

async function workspaceIsActiveAfterBillingChange(
  admin: Admin,
  tenantId: string,
): Promise<{ ok: true; isActive: boolean } | { ok: false; error: string }> {
  const { data: tenantFlags, error } = await admin
    .from('tenants')
    .select('admin_access_suspended_at')
    .eq('id', tenantId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  return { ok: true, isActive: !tenantFlags?.admin_access_suspended_at };
}

export async function grantTenantSubscription(
  admin: Admin,
  input: {
    tenantId: string;
    actorUserId: string;
    platformPlan: PlatformPlanTier;
    billingInterval: PlatformBillingInterval;
    now?: Date;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();

  const { data: billing, error: billingError } = await admin
    .from('tenant_billing_accounts')
    .select(
      'status, stripe_subscription_id, platform_plan, billing_interval, trial_ends_at, trial_started_at, activated_at, admin_granted_at, canceled_at',
    )
    .eq('tenant_id', input.tenantId)
    .maybeSingle();

  if (billingError) return { ok: false, error: billingError.message };
  const blocked = manualSubscriptionGrantBlockReason(billing);
  if (blocked || !billing) {
    return { ok: false, error: blocked ?? 'This workspace has no billing record.' };
  }

  const { error: updateError } = await admin
    .from('tenant_billing_accounts')
    .update({
      status: 'active',
      platform_plan: input.platformPlan,
      billing_interval: input.billingInterval,
      activated_at: billing.activated_at ?? nowIso,
      canceled_at: null,
      admin_granted_at: nowIso,
    })
    .eq('tenant_id', input.tenantId);

  if (updateError) return { ok: false, error: updateError.message };

  const active = await workspaceIsActiveAfterBillingChange(admin, input.tenantId);
  if (!active.ok) return active;

  const { error: tenantError } = await admin
    .from('tenants')
    .update({ is_active: active.isActive })
    .eq('id', input.tenantId);

  if (tenantError) return { ok: false, error: tenantError.message };

  await recordPlatformAuditEvent(admin, {
    actorUserId: input.actorUserId,
    action: TENANT_SUBSCRIPTION_GRANTED_AUDIT,
    targetTenantId: input.tenantId,
    payload: {
      previous_status: billing.status,
      previous_platform_plan: billing.platform_plan,
      previous_billing_interval: billing.billing_interval,
      platform_plan: input.platformPlan,
      billing_interval: input.billingInterval,
    },
  });

  return { ok: true };
}

export async function returnGrantedSubscriptionToTrial(
  admin: Admin,
  input: {
    tenantId: string;
    actorUserId: string;
    now?: Date;
  },
): Promise<{ ok: true; trialEndsAt: string } | { ok: false; error: string }> {
  const now = input.now ?? new Date();

  const { data: billing, error: billingError } = await admin
    .from('tenant_billing_accounts')
    .select(
      'status, stripe_subscription_id, platform_plan, billing_interval, trial_ends_at, trial_started_at, activated_at, admin_granted_at, canceled_at',
    )
    .eq('tenant_id', input.tenantId)
    .maybeSingle();

  if (billingError) return { ok: false, error: billingError.message };
  if (!billing) return { ok: false, error: 'This workspace has no billing record.' };
  if (billing.stripe_subscription_id?.trim()) {
    return {
      ok: false,
      error:
        'This workspace is billed in Stripe. Change the plan there so the charge and access stay in sync.',
    };
  }
  if (!canReturnManualSubscriptionToTrial(billing)) {
    return { ok: false, error: 'This workspace is already on the free-trial checkout path.' };
  }

  const trialEndsAt = restoredTrialEndsAt(billing.trial_ends_at, now);
  const previousEndMs = billing.trial_ends_at
    ? new Date(billing.trial_ends_at).getTime()
    : Number.NaN;
  const replacedTrialEnd = !Number.isFinite(previousEndMs) || previousEndMs <= now.getTime();

  const { error: updateError } = await admin
    .from('tenant_billing_accounts')
    .update({
      status: 'trialing',
      platform_plan: null,
      billing_interval: null,
      admin_granted_at: null,
      canceled_at: null,
      activated_at: null,
      trial_ends_at: trialEndsAt,
      trial_started_at: billing.trial_started_at ?? now.toISOString(),
      ...(replacedTrialEnd ? { trial_ending_reminder_sent_at: null } : {}),
    })
    .eq('tenant_id', input.tenantId);

  if (updateError) return { ok: false, error: updateError.message };

  const active = await workspaceIsActiveAfterBillingChange(admin, input.tenantId);
  if (!active.ok) return active;

  const { error: tenantError } = await admin
    .from('tenants')
    .update({ is_active: active.isActive })
    .eq('id', input.tenantId);

  if (tenantError) return { ok: false, error: tenantError.message };

  await recordPlatformAuditEvent(admin, {
    actorUserId: input.actorUserId,
    action: TENANT_SUBSCRIPTION_GRANT_CLEARED_AUDIT,
    targetTenantId: input.tenantId,
    payload: {
      previous_status: billing.status,
      previous_platform_plan: billing.platform_plan,
      previous_billing_interval: billing.billing_interval,
      trial_ends_at: trialEndsAt,
    },
  });

  return { ok: true, trialEndsAt };
}
