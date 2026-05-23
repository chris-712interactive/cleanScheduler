import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { assertLimitNotExceeded, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { syncedFullNameFromParts } from '@/lib/tenant/customerIdentityName';
import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';

type AdminClient = SupabaseClient<Database>;

export interface InlineQuotePropertyInput {
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  property_kind?: CustomerPropertyKind;
  site_notes?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  stories?: number;
}

/**
 * Creates customer + identity + link + profile + primary property
 * for the quote flow. Does not revalidate or redirect — caller handles paths.
 */
export async function createTenantCustomerInlineForQuote(options: {
  admin: AdminClient;
  tenantId: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  property?: InlineQuotePropertyInput;
}): Promise<
  { ok: true; customerId: string; propertyId: string } | { ok: false; error: string }
> {
  const firstName = options.firstName.trim();
  const lastName = (options.lastName ?? '').trim();
  const email = options.email.trim().toLowerCase();
  const phone = (options.phone ?? '').trim();
  const fullNameSynced = syncedFullNameFromParts(firstName, lastName);

  if (!firstName) {
    return { ok: false, error: 'Customer first name is required.' };
  }
  if (!email) {
    return {
      ok: false,
      error: 'Customer email is required so we can send quote notifications.',
    };
  }

  const planTier = await resolveTenantPlanTier(options.admin, options.tenantId);
  const customerCountResult = await options.admin
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', options.tenantId);

  if (customerCountResult.error) {
    return { ok: false, error: customerCountResult.error.message };
  }

  try {
    assertLimitNotExceeded(planTier, 'maxActiveCustomers', Number(customerCountResult.count ?? 0));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Plan limit reached.';
    return { ok: false, error: message };
  }

  const identityInsert = await options.admin
    .from('customer_identities')
    .insert({
      email,
      first_name: firstName,
      last_name: lastName || null,
      full_name: fullNameSynced,
      phone: phone || null,
    })
    .select('id')
    .single();

  if (identityInsert.error || !identityInsert.data) {
    return { ok: false, error: identityInsert.error?.message ?? 'Could not create customer.' };
  }

  const identityId = identityInsert.data.id as string;

  const customerInsert = await options.admin
    .from('customers')
    .insert({
      tenant_id: options.tenantId,
      customer_identity_id: identityId,
      status: 'active',
    })
    .select('id')
    .single();

  if (customerInsert.error || !customerInsert.data) {
    await options.admin.from('customer_identities').delete().eq('id', identityId);
    return {
      ok: false,
      error: customerInsert.error?.message ?? 'Could not link customer to workspace.',
    };
  }

  const customerId = customerInsert.data.id as string;

  const linkInsert = await options.admin.from('customer_tenant_links').insert({
    customer_identity_id: identityId,
    tenant_id: options.tenantId,
    customer_id: customerId,
    is_primary: true,
  });

  if (linkInsert.error) {
    await options.admin.from('customers').delete().eq('id', customerId);
    await options.admin.from('customer_identities').delete().eq('id', identityId);
    return { ok: false, error: linkInsert.error.message };
  }

  const profileInsert = await options.admin.from('tenant_customer_profiles').insert({
    tenant_id: options.tenantId,
    customer_id: customerId,
    company_name: null,
    preferred_contact_method: 'email',
    preferred_payment_method: 'card',
    internal_notes: null,
  });

  if (profileInsert.error) {
    await options.admin.from('customer_tenant_links').delete().eq('customer_id', customerId);
    await options.admin.from('customers').delete().eq('id', customerId);
    await options.admin.from('customer_identities').delete().eq('id', identityId);
    return { ok: false, error: profileInsert.error.message };
  }

  const propertyInsert = await options.admin
    .from('tenant_customer_properties')
    .insert({
      tenant_id: options.tenantId,
      customer_id: customerId,
      label: 'Primary service location',
      property_kind: options.property?.property_kind ?? 'residential',
      address_line1: options.property?.address_line1?.trim() || null,
      address_line2: options.property?.address_line2?.trim() || null,
      city: options.property?.city?.trim() || null,
      state: options.property?.state?.trim() || null,
      postal_code: options.property?.postal_code?.trim() || null,
      site_notes: options.property?.site_notes?.trim() || null,
      bedrooms: options.property?.bedrooms ?? null,
      bathrooms: options.property?.bathrooms ?? null,
      sqft: options.property?.sqft ?? null,
      stories: options.property?.stories ?? null,
      is_primary: true,
    })
    .select('id')
    .single();

  if (propertyInsert.error || !propertyInsert.data) {
    await options.admin.from('tenant_customer_profiles').delete().eq('customer_id', customerId);
    await options.admin.from('customer_tenant_links').delete().eq('customer_id', customerId);
    await options.admin.from('customers').delete().eq('id', customerId);
    await options.admin.from('customer_identities').delete().eq('id', identityId);
    return { ok: false, error: propertyInsert.error?.message ?? 'Could not create service location.' };
  }

  const propertyId = propertyInsert.data.id as string;

  return { ok: true, customerId, propertyId };
}

/** Adds a service location for an existing customer during quote create. */
export async function createTenantPropertyInlineForQuote(options: {
  admin: AdminClient;
  tenantId: string;
  customerId: string;
  property: InlineQuotePropertyInput;
  label?: string;
}): Promise<{ ok: true; propertyId: string } | { ok: false; error: string }> {
  const line1 = options.property.address_line1?.trim() ?? '';
  if (!line1) {
    return { ok: false, error: 'Street address is required for a new service location.' };
  }

  const { data: cust, error: custErr } = await options.admin
    .from('customers')
    .select('id')
    .eq('id', options.customerId)
    .eq('tenant_id', options.tenantId)
    .maybeSingle();

  if (custErr || !cust) {
    return { ok: false, error: 'Customer not found in this workspace.' };
  }

  const { count } = await options.admin
    .from('tenant_customer_properties')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', options.customerId)
    .eq('tenant_id', options.tenantId);

  const isFirst = (count ?? 0) === 0;
  const label =
    options.label?.trim() ||
    line1 ||
    (isFirst ? 'Primary service location' : 'Service location');

  const propertyInsert = await options.admin
    .from('tenant_customer_properties')
    .insert({
      tenant_id: options.tenantId,
      customer_id: options.customerId,
      label,
      property_kind: options.property.property_kind ?? 'residential',
      address_line1: line1,
      address_line2: options.property.address_line2?.trim() || null,
      city: options.property.city?.trim() || null,
      state: options.property.state?.trim() || null,
      postal_code: options.property.postal_code?.trim() || null,
      site_notes: options.property.site_notes?.trim() || null,
      bedrooms: options.property.bedrooms ?? null,
      bathrooms: options.property.bathrooms ?? null,
      sqft: options.property.sqft ?? null,
      stories: options.property.stories ?? null,
      is_primary: isFirst,
    })
    .select('id')
    .single();

  if (propertyInsert.error || !propertyInsert.data) {
    return {
      ok: false,
      error: propertyInsert.error?.message ?? 'Could not create service location.',
    };
  }

  return { ok: true, propertyId: propertyInsert.data.id as string };
}
