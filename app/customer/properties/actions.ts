'use server';

import { revalidatePath } from 'next/cache';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { lookupUsAddress } from '@/lib/geo/censusGeocode';
import { createAdminClient } from '@/lib/supabase/server';
import { PROPERTY_KIND_OPTIONS, type CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface RequestPropertyState {
  error?: string;
  success?: boolean;
  savedAt?: number;
}

function kindFromForm(value: FormDataEntryValue | null): CustomerPropertyKind {
  const raw = String(value ?? '').trim();
  return PROPERTY_KIND_OPTIONS.some((option) => option.value === raw)
    ? (raw as CustomerPropertyKind)
    : 'residential';
}

export async function requestCustomerPropertyAction(
  _prev: RequestPropertyState,
  formData: FormData,
): Promise<RequestPropertyState> {
  const auth = await requirePortalAccess('customer', '/properties');
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx) return { error: 'No customer profile is linked to this login.' };

  const tenantId = String(formData.get('tenant_id') ?? '').trim();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  if (!UUID_RE.test(tenantId) || !UUID_RE.test(customerId)) {
    return { error: 'Missing account.' };
  }
  const link = ctx.links.find((row) => row.tenantId === tenantId && row.customerId === customerId);
  if (!link) return { error: 'That account is not linked to you.' };

  const line1 = String(formData.get('address_line1') ?? '').trim();
  const line2 = String(formData.get('address_line2') ?? '').trim();
  const city = String(formData.get('city') ?? '').trim();
  const state = String(formData.get('state') ?? '').trim();
  const postal = String(formData.get('postal_code') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();

  if (line1.length < 3 || !city || !state) {
    return { error: 'Add a street, city, and state for the new location.' };
  }
  if (note.length > 500) {
    return { error: 'Keep the note under 500 characters.' };
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from('tenant_customer_properties')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', link.tenantId)
    .eq('customer_id', link.customerId);

  const geocoded = await lookupUsAddress({
    line1,
    city,
    state,
    postalCode: postal,
  });

  const { error } = await admin.from('tenant_customer_properties').insert({
    tenant_id: link.tenantId,
    customer_id: link.customerId,
    label: label || null,
    property_kind: kindFromForm(formData.get('property_kind')),
    address_line1: line1,
    address_line2: line2 || null,
    city,
    state,
    postal_code: postal || null,
    site_notes: note || null,
    latitude: geocoded.point?.lat ?? null,
    longitude: geocoded.point?.lng ?? null,
    geocode_reason: geocoded.reason,
    consultation_requested_at: new Date().toISOString(),
    is_primary: (count ?? 0) === 0,
  });

  if (error) return { error: 'Could not send that location request.' };

  revalidatePath('/properties', 'page');
  revalidatePath('/customer/properties', 'page');
  revalidatePath('/', 'page');
  revalidatePath('/customer', 'page');
  revalidatePath(`/tenant/customers/${link.customerId}`, 'page');
  revalidatePath('/tenant/customers', 'page');
  revalidatePath('/tenant', 'page');
  return { success: true, savedAt: Date.now() };
}
