'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { assertLimitNotExceeded, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import type { Tables } from '@/lib/supabase/database.types';
import { syncedFullNameFromParts } from '@/lib/tenant/customerIdentityName';

export interface CustomerFormState {
  error?: string;
  success?: boolean;
}

function normalizeContactMethod(raw: string): Tables<'tenant_customer_profiles'>['preferred_contact_method'] {
  if (raw === 'email' || raw === 'phone' || raw === 'sms') return raw;
  return null;
}

export async function createTenantCustomer(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const phone = String(formData.get('phone') ?? '').trim();
  const companyName = String(formData.get('company_name') ?? '').trim();
  const serviceAddressLine1 = String(formData.get('service_address_line1') ?? '').trim();
  const serviceAddressLine2 = String(formData.get('service_address_line2') ?? '').trim();
  const serviceCity = String(formData.get('service_city') ?? '').trim();
  const serviceState = String(formData.get('service_state') ?? '').trim();
  const servicePostalCode = String(formData.get('service_postal_code') ?? '').trim();
  const preferredContactMethod = normalizeContactMethod(String(formData.get('preferred_contact_method') ?? '').trim());
  const internalNotes = String(formData.get('internal_notes') ?? '').trim();

  if (!slug || !firstName) {
    return { error: 'Workspace and customer first name are required.' };
  }

  const fullNameSynced = syncedFullNameFromParts(firstName, lastName);

  const membership = await requireTenantPortalAccess(slug, '/customers/new');

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
      first_name: firstName,
      last_name: lastName || null,
      full_name: fullNameSynced,
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

  const profileInsert = await admin.from('tenant_customer_profiles').insert({
    tenant_id: membership.tenantId,
    customer_id: customerId,
    company_name: companyName || null,
    preferred_contact_method: preferredContactMethod,
    internal_notes: internalNotes || null,
  });

  if (profileInsert.error) {
    await admin.from('customer_tenant_links').delete().eq('customer_id', customerId);
    await admin.from('customers').delete().eq('id', customerId);
    await admin.from('customer_identities').delete().eq('id', identityId);
    return { error: profileInsert.error.message };
  }

  const propertyInsert = await admin.from('tenant_customer_properties').insert({
    tenant_id: membership.tenantId,
    customer_id: customerId,
    label: 'Primary service location',
    property_kind: 'residential',
    address_line1: serviceAddressLine1 || null,
    address_line2: serviceAddressLine2 || null,
    city: serviceCity || null,
    state: serviceState || null,
    postal_code: servicePostalCode || null,
    is_primary: true,
  });

  if (propertyInsert.error) {
    await admin.from('tenant_customer_profiles').delete().eq('customer_id', customerId);
    await admin.from('customer_tenant_links').delete().eq('customer_id', customerId);
    await admin.from('customers').delete().eq('id', customerId);
    await admin.from('customer_identities').delete().eq('id', identityId);
    return { error: propertyInsert.error.message };
  }

  revalidatePath('/tenant', 'layout');
  revalidatePath('/tenant', 'page');
  revalidatePath('/tenant/customers', 'page');
  revalidatePath('/tenant/customers/new', 'page');
  redirect('/customers');
}

export async function updateTenantCustomer(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const firstName = String(formData.get('first_name') ?? '').trim();
  const lastName = String(formData.get('last_name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const phone = String(formData.get('phone') ?? '').trim();
  const status = String(formData.get('status') ?? 'active').trim();
  const companyName = String(formData.get('company_name') ?? '').trim();
  const preferredContactMethod = normalizeContactMethod(String(formData.get('preferred_contact_method') ?? '').trim());
  const internalNotes = String(formData.get('internal_notes') ?? '').trim();

  if (!slug || !customerId || !firstName) {
    return { error: 'Workspace, customer, and first name are required.' };
  }

  const fullNameSynced = syncedFullNameFromParts(firstName, lastName);

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
      first_name: firstName,
      last_name: lastName || null,
      full_name: fullNameSynced,
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

  const profileUpsert = await admin.from('tenant_customer_profiles').upsert(
    {
      tenant_id: membership.tenantId,
      customer_id: customerId,
      company_name: companyName || null,
      preferred_contact_method: preferredContactMethod,
      internal_notes: internalNotes || null,
    },
    { onConflict: 'customer_id' },
  );

  if (profileUpsert.error) {
    return { error: profileUpsert.error.message };
  }

  revalidatePath('/tenant', 'layout');
  revalidatePath('/tenant/customers', 'page');
  revalidatePath(`/tenant/customers/${customerId}`, 'page');
  return { success: true };
}
