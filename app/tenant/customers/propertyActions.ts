'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { Database } from '@/lib/supabase/database.types';

export interface PropertyFormState {
  error?: string;
  success?: boolean;
}

const KINDS = new Set<Database['public']['Enums']['customer_property_kind']>([
  'residential',
  'commercial',
  'short_term_rental',
  'other',
]);

function normalizeKind(raw: string): Database['public']['Enums']['customer_property_kind'] {
  return KINDS.has(raw as Database['public']['Enums']['customer_property_kind'])
    ? (raw as Database['public']['Enums']['customer_property_kind'])
    : 'residential';
}

async function revalidateCustomerPaths(customerId: string) {
  revalidatePath('/tenant', 'layout');
  revalidatePath('/tenant/customers', 'page');
  revalidatePath(`/tenant/customers/${customerId}`, 'page');
  revalidatePath('/tenant/quotes', 'page');
  revalidatePath('/tenant/schedule', 'page');
}

export async function addCustomerProperty(_prev: PropertyFormState, formData: FormData): Promise<PropertyFormState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim();
  const kind = normalizeKind(String(formData.get('property_kind') ?? '').trim());
  const line1 = String(formData.get('address_line1') ?? '').trim();
  const line2 = String(formData.get('address_line2') ?? '').trim();
  const city = String(formData.get('city') ?? '').trim();
  const state = String(formData.get('state') ?? '').trim();
  const postal = String(formData.get('postal_code') ?? '').trim();
  const siteNotes = String(formData.get('site_notes') ?? '').trim();
  const wantPrimary = String(formData.get('set_primary') ?? '') === 'on';

  if (!slug || !customerId) {
    return { error: 'Workspace and customer are required.' };
  }

  const membership = await requireTenantPortalAccess(slug, `/customers/${customerId}`);
  const admin = createAdminClient();

  const { data: cust, error: ce } = await admin
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (ce || !cust) {
    return { error: 'Customer not found in this workspace.' };
  }

  const { count } = await admin
    .from('tenant_customer_properties')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('tenant_id', membership.tenantId);

  const isFirst = (count ?? 0) === 0;
  const makePrimary = isFirst || wantPrimary;

  if (makePrimary) {
    await admin
      .from('tenant_customer_properties')
      .update({ is_primary: false })
      .eq('customer_id', customerId)
      .eq('tenant_id', membership.tenantId);
  }

  const ins = await admin.from('tenant_customer_properties').insert({
    tenant_id: membership.tenantId,
    customer_id: customerId,
    label: label || null,
    property_kind: kind,
    address_line1: line1 || null,
    address_line2: line2 || null,
    city: city || null,
    state: state || null,
    postal_code: postal || null,
    site_notes: siteNotes || null,
    is_primary: makePrimary,
  });

  if (ins.error) {
    return { error: ins.error.message };
  }

  await revalidateCustomerPaths(customerId);
  return { success: true };
}

export async function updateCustomerProperty(_prev: PropertyFormState, formData: FormData): Promise<PropertyFormState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const propertyId = String(formData.get('property_id') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim();
  const kind = normalizeKind(String(formData.get('property_kind') ?? '').trim());
  const line1 = String(formData.get('address_line1') ?? '').trim();
  const line2 = String(formData.get('address_line2') ?? '').trim();
  const city = String(formData.get('city') ?? '').trim();
  const state = String(formData.get('state') ?? '').trim();
  const postal = String(formData.get('postal_code') ?? '').trim();
  const siteNotes = String(formData.get('site_notes') ?? '').trim();

  if (!slug || !customerId || !propertyId) {
    return { error: 'Workspace, customer, and property are required.' };
  }

  const membership = await requireTenantPortalAccess(slug, `/customers/${customerId}`);
  const admin = createAdminClient();

  const { data: row, error: fe } = await admin
    .from('tenant_customer_properties')
    .select('id')
    .eq('id', propertyId)
    .eq('customer_id', customerId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (fe || !row) {
    return { error: 'Property not found for this customer.' };
  }

  const upd = await admin
    .from('tenant_customer_properties')
    .update({
      label: label || null,
      property_kind: kind,
      address_line1: line1 || null,
      address_line2: line2 || null,
      city: city || null,
      state: state || null,
      postal_code: postal || null,
      site_notes: siteNotes || null,
    })
    .eq('id', propertyId)
    .eq('tenant_id', membership.tenantId);

  if (upd.error) {
    return { error: upd.error.message };
  }

  await revalidateCustomerPaths(customerId);
  return { success: true };
}

export async function setPrimaryCustomerProperty(
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const propertyId = String(formData.get('property_id') ?? '').trim();

  if (!slug || !customerId || !propertyId) {
    return { error: 'Missing fields.' };
  }

  const membership = await requireTenantPortalAccess(slug, `/customers/${customerId}`);
  const admin = createAdminClient();

  const { data: row, error: fe } = await admin
    .from('tenant_customer_properties')
    .select('id')
    .eq('id', propertyId)
    .eq('customer_id', customerId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (fe || !row) {
    return { error: 'Property not found.' };
  }

  await admin
    .from('tenant_customer_properties')
    .update({ is_primary: false })
    .eq('customer_id', customerId)
    .eq('tenant_id', membership.tenantId);

  const pu = await admin
    .from('tenant_customer_properties')
    .update({ is_primary: true })
    .eq('id', propertyId)
    .eq('tenant_id', membership.tenantId);

  if (pu.error) {
    return { error: pu.error.message };
  }

  await revalidateCustomerPaths(customerId);
  return { success: true };
}

export async function deleteCustomerProperty(
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  const slug = String(formData.get('tenant_slug') ?? '').trim().toLowerCase();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const propertyId = String(formData.get('property_id') ?? '').trim();

  if (!slug || !customerId || !propertyId) {
    return { error: 'Missing fields.' };
  }

  const membership = await requireTenantPortalAccess(slug, `/customers/${customerId}`);
  const admin = createAdminClient();

  const { data: victim, error: fe } = await admin
    .from('tenant_customer_properties')
    .select('id, is_primary')
    .eq('id', propertyId)
    .eq('customer_id', customerId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (fe || !victim) {
    return { error: 'Property not found.' };
  }

  const del = await admin.from('tenant_customer_properties').delete().eq('id', propertyId).eq('tenant_id', membership.tenantId);

  if (del.error) {
    return { error: del.error.message };
  }

  if (victim.is_primary) {
    const { data: nextPrimary } = await admin
      .from('tenant_customer_properties')
      .select('id')
      .eq('customer_id', customerId)
      .eq('tenant_id', membership.tenantId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextPrimary?.id) {
      await admin
        .from('tenant_customer_properties')
        .update({ is_primary: true })
        .eq('id', nextPrimary.id)
        .eq('tenant_id', membership.tenantId);
    }
  }

  await revalidateCustomerPaths(customerId);
  return { success: true };
}
