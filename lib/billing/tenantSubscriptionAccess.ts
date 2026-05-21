import type { Database } from '@/lib/supabase/database.types';

export type TenantBillingStatus = Database['public']['Enums']['tenant_billing_status'];

/** How the tenant workspace should be treated for portal access and UX. */
export type TenantSubscriptionAccess =
  | 'active'
  | 'trialing'
  | 'trial_expired'
  | 'past_due'
  | 'suspended';

export interface TenantSubscriptionAccessInput {
  billingStatus: TenantBillingStatus | null | undefined;
  trialEndsAt: string | null | undefined;
  tenantIsActive: boolean;
  /** When set, trial end is driven by Stripe webhooks. */
  stripeSubscriptionId: string | null | undefined;
  now?: Date;
}

/**
 * Single place to decide whether a tenant can use the portal and what billing UX to show.
 *
 * - **Stripe path:** Checkout creates a subscription with `trial_period_days`. When the trial
 *   ends without a card, Stripe cancels the subscription → `customer.subscription.updated`
 *   webhook sets `canceled` and `tenants.is_active = false`.
 * - **DB-only path:** Onboarding writes `trial_ends_at` before Checkout; if Checkout is skipped
 *   or fails, a cron job must expire the row (no Stripe subscription to fire webhooks).
 */
export function resolveTenantSubscriptionAccess(
  input: TenantSubscriptionAccessInput,
): TenantSubscriptionAccess {
  const now = input.now ?? new Date();
  const status = input.billingStatus ?? 'trialing';
  const tenantActive = input.tenantIsActive !== false;

  if (!tenantActive || status === 'canceled') {
    return 'suspended';
  }

  if (status === 'past_due') {
    return 'past_due';
  }

  if (status === 'active') {
    return 'active';
  }

  if (status === 'trialing') {
    const trialEndMs = input.trialEndsAt ? new Date(input.trialEndsAt).getTime() : null;
    const trialEnded = trialEndMs != null && !Number.isNaN(trialEndMs) && trialEndMs <= now.getTime();

    if (trialEnded) {
      return 'trial_expired';
    }

    return 'trialing';
  }

  return 'suspended';
}

export function isTenantPortalSuspended(access: TenantSubscriptionAccess): boolean {
  return access === 'suspended' || access === 'trial_expired';
}

export function shouldShowTrialPurchaseBanner(access: TenantSubscriptionAccess): boolean {
  return access === 'trialing' || access === 'trial_expired' || access === 'past_due';
}

/** Trial ended or workspace billing canceled — must purchase before using the app. */
export function needsSubscriptionPurchase(access: TenantSubscriptionAccess): boolean {
  return access === 'trial_expired' || access === 'suspended';
}

/** Customer invoicing / Connect tools — only when platform subscription is in good standing. */
export function canAccessCustomerBillingTools(access: TenantSubscriptionAccess): boolean {
  return access === 'active' || access === 'trialing' || access === 'past_due';
}

/** Browser URL path on a tenant subdomain (e.g. `/billing`, `/quotes`). */
export function isTenantBillingHubBrowserPath(path: string | null | undefined): boolean {
  if (!path) return false;
  const normalized = path.split('?')[0]?.replace(/\/$/, '') || '';
  return normalized === '/billing';
}

/** Rewritten App Router path from middleware (`/tenant/billing`). */
export function isTenantBillingHubInternalPath(path: string | null | undefined): boolean {
  if (!path) return false;
  const normalized = path.split('?')[0]?.replace(/\/$/, '') || '';
  return normalized === '/tenant/billing' || normalized === '/billing';
}

/** Owner workspace deletion — allowed while billing is suspended. */
export function isTenantWorkspaceDeletePath(
  internalPath: string | null | undefined,
  browserPath?: string | null | undefined,
): boolean {
  const paths = [internalPath, browserPath]
    .map((path) => path?.split('?')[0]?.replace(/\/$/, '') || '')
    .filter(Boolean);
  return paths.some(
    (path) => path === '/settings/account' || path === '/tenant/settings/account',
  );
}

export function isTenantBillingHubPath(
  internalPath: string | null | undefined,
  browserPath?: string | null | undefined,
): boolean {
  return (
    isTenantBillingHubBrowserPath(browserPath) || isTenantBillingHubInternalPath(internalPath)
  );
}

export function isTenantSuspendedEscapePath(
  internalPath: string | null | undefined,
  browserPath?: string | null | undefined,
): boolean {
  return (
    isTenantBillingHubPath(internalPath, browserPath) ||
    isTenantWorkspaceDeletePath(internalPath, browserPath)
  );
}

export function trialDaysRemaining(
  trialEndsAt: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt).getTime();
  if (Number.isNaN(end)) return null;
  const diff = end - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
