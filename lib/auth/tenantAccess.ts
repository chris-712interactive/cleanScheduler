import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import {
  isTenantPortalSuspended,
  isTenantSuspendedEscapePath,
  needsSubscriptionPurchase,
  resolveTenantSubscriptionAccess,
} from '@/lib/billing/tenantSubscriptionAccess';
import { enforceFieldEmployeeRouteAccess, isFieldEmployeeRole } from '@/lib/tenant/fieldEmployeeAccess';
import { requirePortalAccess } from './portalAccess';
import type { TenantRole } from './types';

export interface TenantMembership {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: TenantRole;
}

export interface TenantPortalAccessOptions {
  /** Post-rewrite pathname from middleware (`x-internal-pathname`), e.g. `/tenant/billing`. */
  internalPathname?: string | null;
  /** Browser pathname on the tenant host (`x-tenant-pathname`), e.g. `/quotes`. */
  browserPathname?: string | null;
  /** Allow access when subscription is canceled (resume-checkout server action). */
  allowBillingResume?: boolean;
  /** Skip field-employee route allowlist (server actions, API routes). */
  skipFieldEmployeeRouteEnforcement?: boolean;
}

async function lookupMembership(
  userId: string,
  tenantSlug: string,
): Promise<TenantMembership | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('tenant_memberships')
    .select(
      `
      tenant_id,
      role,
      tenants:tenants!inner (
        id,
        slug,
        name
      )
    `,
    )
    .eq('user_id', userId)
    .eq('tenants.slug', tenantSlug)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data || !data.tenants) {
    return null;
  }

  return {
    tenantId: data.tenant_id,
    tenantSlug: data.tenants.slug,
    tenantName: data.tenants.name,
    role: data.role,
  };
}

async function lookupTenantBySlug(
  tenantSlug: string,
): Promise<{ id: string; slug: string; name: string } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('tenants')
    .select('id, slug, name')
    .eq('slug', tenantSlug)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

async function assertTenantWorkspaceUnlocked(
  tenantId: string,
  options?: TenantPortalAccessOptions & { memberRole?: TenantRole },
): Promise<void> {
  // Field employees cannot manage billing — avoid redirect loops to /billing.
  if (options?.memberRole === 'employee') {
    return;
  }

  const allowWhenSuspended =
    options?.allowBillingResume === true ||
    isTenantSuspendedEscapePath(options?.internalPathname, options?.browserPathname);

  const admin = createAdminClient();
  const [{ data: tenantRow }, { data: billingRow }] = await Promise.all([
    admin.from('tenants').select('is_active').eq('id', tenantId).maybeSingle(),
    admin
      .from('tenant_billing_accounts')
      .select('status, trial_ends_at, stripe_subscription_id')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
  ]);

  const access = resolveTenantSubscriptionAccess({
    billingStatus: billingRow?.status,
    trialEndsAt: billingRow?.trial_ends_at,
    tenantIsActive: tenantRow?.is_active !== false,
    stripeSubscriptionId: billingRow?.stripe_subscription_id,
  });

  if (!isTenantPortalSuspended(access)) {
    return;
  }

  if (allowWhenSuspended) {
    return;
  }

  redirect('/billing?subscribe=required');
}

/**
 * Enforces tenant-portal membership by slug and returns normalized membership
 * context for layout/page rendering.
 */
export async function requireTenantPortalAccess(
  tenantSlug: string | null,
  nextPath: string,
  accessOptions?: TenantPortalAccessOptions,
): Promise<TenantMembership> {
  const auth = await requirePortalAccess('tenant', nextPath);
  const slug = tenantSlug?.trim().toLowerCase() ?? '';

  if (!slug) {
    redirect('/access-denied?reason=tenant_config');
  }

  const requestHeaders = await headers();
  const headerInternalPath = requestHeaders.get('x-internal-pathname');
  const headerBrowserPath = requestHeaders.get('x-tenant-pathname');
  const mergedOptions: TenantPortalAccessOptions = {
    allowBillingResume: accessOptions?.allowBillingResume === true,
    internalPathname: accessOptions?.internalPathname ?? headerInternalPath,
    browserPathname: accessOptions?.browserPathname ?? headerBrowserPath,
  };

  const membership = await lookupMembership(auth.user.id, slug);
  const isPlatformAdmin =
    auth.claims.appRole === 'super_admin' || auth.claims.appRole === 'admin';

  if (membership) {
    await assertTenantWorkspaceUnlocked(membership.tenantId, {
      ...mergedOptions,
      memberRole: membership.role,
    });

    let subscriptionLocked = false;
    if (isFieldEmployeeRole(membership.role)) {
      const admin = createAdminClient();
      const [{ data: tenantRow }, { data: billingRow }] = await Promise.all([
        admin.from('tenants').select('is_active').eq('id', membership.tenantId).maybeSingle(),
        admin
          .from('tenant_billing_accounts')
          .select('status, trial_ends_at, stripe_subscription_id')
          .eq('tenant_id', membership.tenantId)
          .maybeSingle(),
      ]);
      const access = resolveTenantSubscriptionAccess({
        billingStatus: billingRow?.status,
        trialEndsAt: billingRow?.trial_ends_at,
        tenantIsActive: tenantRow?.is_active !== false,
        stripeSubscriptionId: billingRow?.stripe_subscription_id,
      });
      subscriptionLocked = needsSubscriptionPurchase(access);
    }

    if (
      accessOptions?.skipFieldEmployeeRouteEnforcement !== true &&
      !isPlatformAdmin
    ) {
      const pathForFieldCheck =
        mergedOptions.browserPathname ??
        (nextPath.startsWith('/tenant/') ? null : nextPath);
      if (pathForFieldCheck) {
        enforceFieldEmployeeRouteAccess(membership.role, pathForFieldCheck, {
          subscriptionLocked,
        });
      }
    }
    return membership;
  }

  // Founder / platform ops: no tenant_memberships row required if the tenant
  // exists (support, demos, pre-invite debugging).
  if (isPlatformAdmin) {
    const tenant = await lookupTenantBySlug(slug);
    if (tenant) {
      await assertTenantWorkspaceUnlocked(tenant.id, mergedOptions);
      return {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        role: 'admin',
      };
    }
    redirect('/access-denied?reason=unknown_tenant');
  }

  if (await hasInactiveMembership(auth.user.id, slug)) {
    redirect('/access-denied?reason=membership_inactive');
  }

  redirect('/access-denied?reason=membership');
}

async function hasInactiveMembership(userId: string, tenantSlug: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('tenant_memberships')
    .select('is_active, tenants:tenants!inner(slug)')
    .eq('user_id', userId)
    .eq('tenants.slug', tenantSlug)
    .maybeSingle();

  return Boolean(data && data.is_active === false);
}
