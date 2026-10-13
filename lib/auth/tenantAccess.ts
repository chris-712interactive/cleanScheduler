import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import {
  isTenantPortalSuspended,
  needsSubscriptionPurchase,
  resolveTenantSubscriptionAccess,
} from '@/lib/billing/tenantSubscriptionAccess';
import {
  enforceFieldEmployeeRouteAccess,
  isFieldEmployeeRole,
} from '@/lib/tenant/fieldEmployeeAccess';
import { readRequestAuthGrant } from '@/lib/auth/readRequestAuthGrant';
import type { RequestAuthGrantTenant } from '@/lib/auth/requestAuthGrant';
import { decideWorkspaceGate } from '@/lib/auth/workspaceGate';
import { enforceTenantAuthPolicy } from './enforceTenantAuthPolicy';
import { requirePortalAccess } from './portalAccess';
import type { AuthContext, TenantRole } from './types';

export interface TenantMembership {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: TenantRole;
  roleId: string | null;
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
  /** Platform admins may enter suspended workspaces for support / masquerade. */
  bypassAdminSuspension?: boolean;
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
      role_id,
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
    roleId: data.role_id ?? null,
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

  const admin = createAdminClient();
  const [{ data: tenantRow }, { data: billingRow }] = await Promise.all([
    admin
      .from('tenants')
      .select('is_active, admin_access_suspended_at')
      .eq('id', tenantId)
      .maybeSingle(),
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

  applyWorkspaceGate({
    memberRole: options?.memberRole ?? 'owner',
    adminSuspended: Boolean(tenantRow?.admin_access_suspended_at),
    subscriptionLocked: isTenantPortalSuspended(access),
    allowBillingResume: options?.allowBillingResume,
    internalPathname: options?.internalPathname,
    browserPathname: options?.browserPathname,
    bypassAdminSuspension: options?.bypassAdminSuspension,
  });
}

function applyWorkspaceGate(input: Parameters<typeof decideWorkspaceGate>[0]): void {
  const decision = decideWorkspaceGate(input);
  if (decision === 'workspace_suspended') {
    redirect('/access-denied?reason=workspace_suspended');
  }
  if (decision === 'subscribe_required') {
    redirect('/billing?subscribe=required');
  }
}

function subscriptionLockedForTenant(tenant: RequestAuthGrantTenant): boolean {
  return isTenantPortalSuspended(
    resolveTenantSubscriptionAccess({
      billingStatus: tenant.billingStatus,
      trialEndsAt: tenant.trialEndsAt,
      tenantIsActive: tenant.tenantIsActive,
      stripeSubscriptionId: tenant.stripeSubscriptionId,
    }),
  );
}

async function finishMemberAccess(input: {
  auth: AuthContext;
  membership: TenantMembership;
  isPlatformAdmin: boolean;
  mergedOptions: TenantPortalAccessOptions;
  accessOptions?: TenantPortalAccessOptions;
  nextPath: string;
  subscriptionLocked: boolean;
}): Promise<void> {
  if (!input.isPlatformAdmin) {
    await enforceTenantAuthPolicy({
      tenantId: input.membership.tenantId,
      userId: input.auth.user.id,
      browserPathname: input.mergedOptions.browserPathname ?? input.mergedOptions.internalPathname,
      bypass: false,
    });
  }

  if (input.accessOptions?.skipFieldEmployeeRouteEnforcement !== true && !input.isPlatformAdmin) {
    const pathForFieldCheck =
      input.mergedOptions.browserPathname ??
      (input.nextPath.startsWith('/tenant/') ? null : input.nextPath);
    if (pathForFieldCheck) {
      enforceFieldEmployeeRouteAccess(input.membership.role, pathForFieldCheck, {
        subscriptionLocked: input.subscriptionLocked,
      });
    }
  }
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

  const isPlatformAdmin = auth.claims.appRole === 'super_admin' || auth.claims.appRole === 'admin';
  const grant = await readRequestAuthGrant();
  const grantedTenant =
    grant && grant.uid === auth.user.id && grant.tenant?.tenantSlug === slug ? grant.tenant : null;

  if (grantedTenant) {
    const subscriptionLocked = subscriptionLockedForTenant(grantedTenant);
    applyWorkspaceGate({
      memberRole: grantedTenant.role,
      adminSuspended: grantedTenant.adminSuspended,
      subscriptionLocked,
      allowBillingResume: mergedOptions.allowBillingResume,
      internalPathname: mergedOptions.internalPathname,
      browserPathname: mergedOptions.browserPathname,
      bypassAdminSuspension: isPlatformAdmin,
    });
    const membership: TenantMembership = {
      tenantId: grantedTenant.tenantId,
      tenantSlug: grantedTenant.tenantSlug,
      tenantName: grantedTenant.tenantName,
      role: grantedTenant.role,
      roleId: grantedTenant.roleId,
    };
    await finishMemberAccess({
      auth,
      membership,
      isPlatformAdmin,
      mergedOptions,
      accessOptions,
      nextPath,
      subscriptionLocked: isFieldEmployeeRole(membership.role) ? subscriptionLocked : false,
    });
    return membership;
  }

  const membership = await lookupMembership(auth.user.id, slug);

  if (membership) {
    await assertTenantWorkspaceUnlocked(membership.tenantId, {
      ...mergedOptions,
      memberRole: membership.role,
      bypassAdminSuspension: isPlatformAdmin,
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

    await finishMemberAccess({
      auth,
      membership,
      isPlatformAdmin,
      mergedOptions,
      accessOptions,
      nextPath,
      subscriptionLocked,
    });
    return membership;
  }

  // Founder / platform ops: no tenant_memberships row required if the tenant
  // exists (support, demos, pre-invite debugging).
  if (isPlatformAdmin) {
    const tenant = await lookupTenantBySlug(slug);
    if (tenant) {
      await assertTenantWorkspaceUnlocked(tenant.id, {
        ...mergedOptions,
        bypassAdminSuspension: true,
      });
      return {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantName: tenant.name,
        role: 'admin',
        roleId: null,
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
