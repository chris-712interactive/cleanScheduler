'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requirePlatformAdmin } from '@/lib/auth/portalAccess';
import {
  grantTenantSubscription,
  returnGrantedSubscriptionToTrial,
} from '@/lib/billing/grantTenantSubscription';
import { parsePlatformBillingInterval } from '@/lib/billing/platformPlans';
import { parsePlatformPlanTier } from '@/lib/billing/platformPlanTier';

export interface GrantTenantSubscriptionFormState {
  error?: string;
}

async function loadMatchingTenant(tenantId: string, tenantSlug: string) {
  const admin = createAdminClient();
  const { data: tenant, error } = await admin
    .from('tenants')
    .select('id, slug')
    .eq('id', tenantId)
    .maybeSingle();

  if (error || !tenant || tenant.slug !== tenantSlug) {
    return { admin, tenant: null as null };
  }
  return { admin, tenant };
}

export async function grantTenantSubscriptionAction(
  _prev: GrantTenantSubscriptionFormState,
  formData: FormData,
): Promise<GrantTenantSubscriptionFormState> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const tenantId = String(formData.get('tenant_id') ?? '').trim();
  const platformPlan = parsePlatformPlanTier(String(formData.get('platform_plan') ?? ''));
  const billingInterval = parsePlatformBillingInterval(
    String(formData.get('billing_interval') ?? ''),
  );

  const auth = await requirePlatformAdmin(`/tenants/${tenantSlug}`);
  if (!platformPlan) {
    return { error: 'Choose Starter, Business, or Pro.' };
  }
  if (!billingInterval) {
    return { error: 'Choose monthly or yearly billing.' };
  }

  const { admin, tenant } = await loadMatchingTenant(tenantId, tenantSlug);
  if (!tenant) return { error: 'Tenant not found.' };

  const result = await grantTenantSubscription(admin, {
    tenantId: tenant.id,
    actorUserId: auth.user.id,
    platformPlan,
    billingInterval,
  });
  if (!result.ok) return { error: result.error };

  redirect(`/tenants/${tenant.slug}?plan=granted`);
}

export async function returnGrantedSubscriptionToTrialAction(
  _prev: GrantTenantSubscriptionFormState,
  formData: FormData,
): Promise<GrantTenantSubscriptionFormState> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const tenantId = String(formData.get('tenant_id') ?? '').trim();

  const auth = await requirePlatformAdmin(`/tenants/${tenantSlug}`);
  const { admin, tenant } = await loadMatchingTenant(tenantId, tenantSlug);
  if (!tenant) return { error: 'Tenant not found.' };

  const result = await returnGrantedSubscriptionToTrial(admin, {
    tenantId: tenant.id,
    actorUserId: auth.user.id,
  });
  if (!result.ok) return { error: result.error };

  redirect(`/tenants/${tenant.slug}?plan=trial`);
}
