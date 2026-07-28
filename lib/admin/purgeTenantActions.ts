'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/session';
import { purgeTenantWorkspace } from '@/lib/billing/tenantPurge';

export interface AdminPurgeTenantFormState {
  error?: string;
}

export async function purgeCanceledTenantAction(
  _prev: AdminPurgeTenantFormState,
  formData: FormData,
): Promise<AdminPurgeTenantFormState> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const tenantId = String(formData.get('tenant_id') ?? '').trim();
  const confirmSlug = String(formData.get('confirm_slug') ?? '')
    .trim()
    .toLowerCase();

  if (!tenantSlug || !tenantId) {
    return { error: 'Tenant is required.' };
  }

  const auth = await requireAuth(`/tenants/${tenantSlug}`);
  const role = auth.claims.appRole;
  if (role !== 'super_admin' && role !== 'admin') {
    redirect('/access-denied?reason=forbidden');
  }

  if (confirmSlug !== tenantSlug) {
    return { error: 'Type the tenant slug exactly to confirm deletion.' };
  }

  const admin = createAdminClient();
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('id, slug')
    .eq('id', tenantId)
    .maybeSingle();

  if (tenantError || !tenant || tenant.slug !== tenantSlug) {
    return { error: 'Tenant not found.' };
  }

  const result = await purgeTenantWorkspace(admin, tenantId, {
    reason: 'admin_requested',
    actorUserId: auth.user.id,
  });

  if (!result.deleted) {
    return {
      error:
        'Only canceled tenants can be deleted from admin. Confirm billing status is canceled, then try again.',
    };
  }

  redirect(`/tenants?purged=${encodeURIComponent(tenantSlug)}`);
}
