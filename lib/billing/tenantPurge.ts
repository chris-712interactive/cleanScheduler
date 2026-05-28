import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getStripe } from '@/lib/stripe/server';
import { revokePlaidBankLink } from '@/lib/plaid/revokePlaidBankLink';

/** Days after free trial ends before an never-activated workspace is hard-deleted. */
export const UNCONVERTED_TRIAL_PURGE_GRACE_DAYS = 30;

type Admin = SupabaseClient<Database>;

export interface TenantBillingPurgeSnapshot {
  activated_at: string | null;
  trial_ends_at: string | null;
  stripe_subscription_id?: string | null;
  stripe_customer_id?: string | null;
}

export interface TenantPurgeStatus {
  /** Workspace never converted to a paid/active subscription. */
  neverActivated: boolean;
  /** When automatic purge runs (trial end + grace), if applicable. */
  autoPurgeAt: Date | null;
  /** Whole days until auto purge; 0 when purge is due or overdue. */
  daysUntilAutoPurge: number | null;
  /** True when auto purge date is today or in the past. */
  autoPurgeOverdue: boolean;
}

export function trialAutoPurgeAt(trialEndsAt: string | null | undefined): Date | null {
  if (!trialEndsAt) return null;
  const trialEnd = new Date(trialEndsAt);
  if (Number.isNaN(trialEnd.getTime())) return null;
  const purgeAt = new Date(trialEnd);
  purgeAt.setUTCDate(purgeAt.getUTCDate() + UNCONVERTED_TRIAL_PURGE_GRACE_DAYS);
  return purgeAt;
}

export function getTenantPurgeStatus(
  billing: TenantBillingPurgeSnapshot | null | undefined,
  now: Date = new Date(),
): TenantPurgeStatus {
  const neverActivated = !billing?.activated_at;
  const autoPurgeAt = neverActivated ? trialAutoPurgeAt(billing?.trial_ends_at) : null;

  if (!neverActivated || !autoPurgeAt) {
    return {
      neverActivated: false,
      autoPurgeAt: null,
      daysUntilAutoPurge: null,
      autoPurgeOverdue: false,
    };
  }

  const msUntil = autoPurgeAt.getTime() - now.getTime();
  const daysUntilAutoPurge = Math.max(0, Math.ceil(msUntil / (1000 * 60 * 60 * 24)));

  return {
    neverActivated: true,
    autoPurgeAt,
    daysUntilAutoPurge,
    autoPurgeOverdue: msUntil <= 0,
  };
}

export function isEligibleForUnconvertedTrialAutoPurge(
  billing: TenantBillingPurgeSnapshot,
  now: Date = new Date(),
): boolean {
  if (billing.activated_at) return false;
  const purgeAt = trialAutoPurgeAt(billing.trial_ends_at);
  if (!purgeAt) return false;
  return purgeAt.getTime() <= now.getTime();
}

export async function findTenantIdsForUnconvertedTrialAutoPurge(
  admin: Admin,
  now: Date = new Date(),
): Promise<string[]> {
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - UNCONVERTED_TRIAL_PURGE_GRACE_DAYS);

  const { data, error } = await admin
    .from('tenant_billing_accounts')
    .select('tenant_id')
    .is('activated_at', null)
    .not('trial_ends_at', 'is', null)
    .lte('trial_ends_at', cutoff.toISOString());

  if (error) {
    throw new Error(error.message);
  }

  return [...new Set((data ?? []).map((row) => row.tenant_id))];
}

async function cancelStripeSubscriptionIfPresent(
  stripeSubscriptionId: string | null | undefined,
): Promise<void> {
  const subId = stripeSubscriptionId?.trim();
  if (!subId) return;

  const stripe = getStripe();
  if (!stripe) return;

  try {
    const sub = await stripe.subscriptions.retrieve(subId);
    if (sub.status !== 'canceled' && sub.status !== 'incomplete_expired') {
      await stripe.subscriptions.cancel(subId);
    }
  } catch {
    // Best-effort cleanup before tenant delete.
  }
}

/**
 * Hard-delete a tenant workspace and cascade tenant-scoped data.
 * Does not delete Supabase Auth users (they may belong to other workspaces).
 */
export async function purgeTenantWorkspace(
  admin: Admin,
  tenantId: string,
  options: {
    reason: 'auto_unconverted_trial' | 'owner_requested';
    actorUserId?: string | null;
  },
): Promise<{ deleted: boolean; slug: string | null }> {
  const [{ data: tenant }, { data: billing }] = await Promise.all([
    admin.from('tenants').select('id, slug, name').eq('id', tenantId).maybeSingle(),
    admin
      .from('tenant_billing_accounts')
      .select('activated_at, trial_ends_at, stripe_subscription_id, stripe_customer_id')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
  ]);

  if (!tenant) {
    return { deleted: false, slug: null };
  }

  if (options.reason === 'auto_unconverted_trial') {
    if (!billing || !isEligibleForUnconvertedTrialAutoPurge(billing)) {
      return { deleted: false, slug: tenant.slug };
    }
  }

  await cancelStripeSubscriptionIfPresent(billing?.stripe_subscription_id);

  try {
    await revokePlaidBankLink(admin, tenantId, {
      reason: 'workspace_purged',
      skipLocalUpdate: true,
    });
  } catch (error) {
    console.error('[purgeTenantWorkspace] Plaid revoke failed', tenantId, error);
  }

  await admin.from('audit_log_entries').insert({
    actor_user_id: options.actorUserId ?? null,
    action: 'tenant.workspace_purged',
    target_tenant_id: tenantId,
    payload: {
      reason: options.reason,
      tenant_slug: tenant.slug,
      tenant_name: tenant.name,
      never_activated: !billing?.activated_at,
      trial_ends_at: billing?.trial_ends_at ?? null,
    },
  });

  const { error } = await admin.from('tenants').delete().eq('id', tenantId);
  if (error) {
    throw new Error(error.message);
  }

  return { deleted: true, slug: tenant.slug };
}

export async function purgeUnconvertedTrialWorkspaces(
  admin: Admin,
): Promise<{ purgedTenantIds: string[]; skippedTenantIds: string[] }> {
  const tenantIds = await findTenantIdsForUnconvertedTrialAutoPurge(admin);
  const purgedTenantIds: string[] = [];
  const skippedTenantIds: string[] = [];

  for (const tenantId of tenantIds) {
    const result = await purgeTenantWorkspace(admin, tenantId, {
      reason: 'auto_unconverted_trial',
    });
    if (result.deleted) {
      purgedTenantIds.push(tenantId);
    } else {
      skippedTenantIds.push(tenantId);
    }
  }

  return { purgedTenantIds, skippedTenantIds };
}

export function formatAutoPurgeDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
