'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requirePlatformAdmin } from '@/lib/auth/portalAccess';
import { extendTenantTrial, parseTrialExtensionDays } from '@/lib/billing/extendTenantTrial';

export interface ExtendTenantTrialFormState {
  error?: string;
}

export async function extendTenantTrialAction(
  _prev: ExtendTenantTrialFormState,
  formData: FormData,
): Promise<ExtendTenantTrialFormState> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const tenantId = String(formData.get('tenant_id') ?? '').trim();
  const days = parseTrialExtensionDays(String(formData.get('days') ?? ''));

  const auth = await requirePlatformAdmin(`/tenants/${tenantSlug}`);
  if (!days) {
    return { error: 'Enter a whole number of days from 1 to 90.' };
  }

  const admin = createAdminClient();
  const { data: tenant, error } = await admin
    .from('tenants')
    .select('id, slug')
    .eq('id', tenantId)
    .maybeSingle();

  if (error || !tenant || tenant.slug !== tenantSlug) {
    return { error: 'Tenant not found.' };
  }

  const result = await extendTenantTrial(admin, {
    tenantId: tenant.id,
    actorUserId: auth.user.id,
    extraDays: days,
  });
  if (!result.ok) return { error: result.error };

  redirect(`/tenants/${tenant.slug}?trial=extended`);
}
