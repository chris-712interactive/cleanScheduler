'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { assertLimitNotExceeded, resolveTenantPlanTier } from '@/lib/billing/entitlements';

export interface CustomerFormState {
  error?: string;
  success?: boolean;
}

export async function createTenantCustomer(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const fullName = String(formData.get('full_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const phone = String(formData.get('phone') ?? '').trim();

  if (!slug || !fullName) {
    return { error: 'Workspace and customer name are required.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/customers');

  const admin = createAdminClient();

  const planTier = await resolveTenantPlanTier(admin, membership.tenantId);
  const customerCountResult = await admin
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', membership.tenantId);

  if (customerCountResult.error) {
    return { error: customerCountResult.error.message };
  }

  try {
    assertLimitNotExceeded(
      planTier,
      'maxActiveCustomers',
      Number(customerCountResult.count ?? 0),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Plan limit reached.';
    return { error: message };
  }

  const identityInsert = await admin
    .from('customer_identities')
    .insert({
      email: email || null,
      full_name: fullName,
      phone: phone || null,
    })
    .select('id')
    .single();

  if (identityInsert.error || !identityInsert.data) {
    return { error: identityInsert.error?.message ?? 'Could not create customer.' };
  }

  const identityId = identityInsert.data.id as string;

  const customerInsert = await admin
    .from('customers')
    .insert({
      tenant_id: membership.tenantId,
      customer_identity_id: identityId,
      status: 'active',
    })
    .select('id')
    .single();

  if (customerInsert.error || !customerInsert.data) {
    await admin.from('customer_identities').delete().eq('id', identityId);
    return { error: customerInsert.error?.message ?? 'Could not link customer to workspace.' };
  }

  const customerId = customerInsert.data.id as string;

  const linkInsert = await admin.from('customer_tenant_links').insert({
    customer_identity_id: identityId,
    tenant_id: membership.tenantId,
    customer_id: customerId,
    is_primary: true,
  });

  if (linkInsert.error) {
    await admin.from('customers').delete().eq('id', customerId);
    await admin.from('customer_identities').delete().eq('id', identityId);
    return { error: linkInsert.error.message };
  }

  revalidatePath('/tenant/customers');
  return { success: true };
}

export async function updateTenantCustomer(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const fullName = String(formData.get('full_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const phone = String(formData.get('phone') ?? '').trim();
  const status = String(formData.get('status') ?? 'active').trim();

  if (!slug || !customerId || !fullName) {
    return { error: 'Workspace, customer, and full name are required.' };
  }

  const membership = await requireTenantPortalAccess(slug, `/customers/${customerId}`);

  const admin = createAdminClient();
  const { data: row, error: fetchError } = await admin
    .from('customers')
    .select('id, customer_identity_id')
    .eq('id', customerId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (fetchError || !row) {
    return { error: 'Customer not found in this workspace.' };
  }

  const identityUpdate = await admin
    .from('customer_identities')
    .update({
      full_name: fullName,
      email: email || null,
      phone: phone || null,
    })
    .eq('id', row.customer_identity_id);

  if (identityUpdate.error) {
    return { error: identityUpdate.error.message };
  }

  const statusNorm = status === 'inactive' ? 'inactive' : 'active';
  const customerUpdate = await admin.from('customers').update({ status: statusNorm }).eq('id', customerId);

  if (customerUpdate.error) {
    return { error: customerUpdate.error.message };
  }

  revalidatePath('/tenant/customers');
  revalidatePath(`/tenant/customers/${customerId}`);
  return { success: true };
}
