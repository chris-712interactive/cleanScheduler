import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { recordPlatformAuditEvent } from '@/lib/audit/recordPlatformAuditEvent';

type Admin = SupabaseClient<Database>;

export const TRIAL_EXTENSION_MIN_DAYS = 1;
export const TRIAL_EXTENSION_MAX_DAYS = 90;
export const TENANT_TRIAL_EXTENDED_AUDIT = 'tenant.trial_extended';

export type TrialExtensionBilling = {
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  trial_ends_at: string | null;
  trial_started_at: string | null;
  activated_at: string | null;
  stripe_subscription_id: string | null;
};

export function trialExtensionBlockReason(billing: TrialExtensionBilling | null): string | null {
  if (!billing) return 'This workspace has no billing record.';
  if (billing.stripe_subscription_id) {
    return 'This trial is managed in Stripe. Change the trial end on the subscription there.';
  }
  if (billing.status === 'active' || billing.status === 'past_due') {
    return 'This workspace already has a paid subscription.';
  }
  if (billing.activated_at) {
    return 'This workspace already subscribed. Start a new subscription instead of extending the trial.';
  }
  if (billing.status === 'trialing' || billing.status === 'canceled') return null;
  return 'This workspace is not on a free trial.';
}

export function nextTrialEndsAt(
  currentEndsAt: string | null,
  extraDays: number,
  now: Date,
): string {
  const currentMs = currentEndsAt ? new Date(currentEndsAt).getTime() : Number.NaN;
  const base = Number.isFinite(currentMs) && currentMs > now.getTime() ? new Date(currentMs) : now;
  const end = new Date(base);
  end.setUTCDate(end.getUTCDate() + extraDays);
  return end.toISOString();
}

export function parseTrialExtensionDays(raw: string): number | null {
  const days = Number(raw.trim());
  if (
    !Number.isInteger(days) ||
    days < TRIAL_EXTENSION_MIN_DAYS ||
    days > TRIAL_EXTENSION_MAX_DAYS
  ) {
    return null;
  }
  return days;
}

export async function extendTenantTrial(
  admin: Admin,
  input: {
    tenantId: string;
    actorUserId: string;
    extraDays: number;
    now?: Date;
  },
): Promise<{ ok: true; trialEndsAt: string; reopened: boolean } | { ok: false; error: string }> {
  if (
    !Number.isInteger(input.extraDays) ||
    input.extraDays < TRIAL_EXTENSION_MIN_DAYS ||
    input.extraDays > TRIAL_EXTENSION_MAX_DAYS
  ) {
    return {
      ok: false,
      error: `Enter a whole number of days between ${TRIAL_EXTENSION_MIN_DAYS} and ${TRIAL_EXTENSION_MAX_DAYS}.`,
    };
  }

  const { data: billing, error: billingError } = await admin
    .from('tenant_billing_accounts')
    .select(
      'status, trial_ends_at, trial_started_at, activated_at, stripe_subscription_id, canceled_at',
    )
    .eq('tenant_id', input.tenantId)
    .maybeSingle();

  if (billingError) return { ok: false, error: billingError.message };
  const blocked = trialExtensionBlockReason(billing);
  if (blocked || !billing)
    return { ok: false, error: blocked ?? 'This workspace has no billing record.' };

  const now = input.now ?? new Date();
  const trialEndsAt = nextTrialEndsAt(billing.trial_ends_at, input.extraDays, now);
  const reopened = billing.status === 'canceled';

  const { error: updateError } = await admin
    .from('tenant_billing_accounts')
    .update({
      status: 'trialing',
      trial_ends_at: trialEndsAt,
      trial_started_at: billing.trial_started_at ?? now.toISOString(),
      canceled_at: null,
      trial_ending_reminder_sent_at: null,
    })
    .eq('tenant_id', input.tenantId);

  if (updateError) return { ok: false, error: updateError.message };

  if (reopened) {
    const { error: tenantError } = await admin
      .from('tenants')
      .update({ is_active: true })
      .eq('id', input.tenantId);
    if (tenantError) return { ok: false, error: tenantError.message };
  }

  await recordPlatformAuditEvent(admin, {
    actorUserId: input.actorUserId,
    action: TENANT_TRIAL_EXTENDED_AUDIT,
    targetTenantId: input.tenantId,
    payload: {
      extra_days: input.extraDays,
      previous_trial_ends_at: billing.trial_ends_at,
      trial_ends_at: trialEndsAt,
      reopened,
    },
  });

  return { ok: true, trialEndsAt, reopened };
}
