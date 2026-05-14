import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { assertLimitNotExceeded, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { syncedFullNameFromParts } from '@/lib/tenant/customerIdentityName';

type AdminClient = SupabaseClient<Database>;

/**
 * Creates customer + identity + link + profile + primary property (minimal address)
 * for the quote flow. Does not revalidate or redirect — caller handles paths.
 */
export async function createTenantCustomerInlineForQuote(options: {
  admin: AdminClient;
  tenantId: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
}): Promise<{ ok: true; customerId: string } | { ok: false; error: string }> {
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
    assertLimitNotExceeded(
      planTier,
      'maxActiveCustomers',
      Number(customerCountResult.count ?? 0),
    );
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
    return { ok: false, error: customerInsert.error?.message ?? 'Could not link customer to workspace.' };
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
    internal_notes: null,
  });

  if (profileInsert.error) {
    await options.admin.from('customer_tenant_links').delete().eq('customer_id', customerId);
    await options.admin.from('customers').delete().eq('id', customerId);
    await options.admin.from('customer_identities').delete().eq('id', identityId);
    return { ok: false, error: profileInsert.error.message };
  }

  const propertyInsert = await options.admin.from('tenant_customer_properties').insert({
    tenant_id: options.tenantId,
    customer_id: customerId,
    label: 'Primary service location',
    property_kind: 'residential',
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    postal_code: null,
    is_primary: true,
  });

  if (propertyInsert.error) {
    await options.admin.from('tenant_customer_profiles').delete().eq('customer_id', customerId);
    await options.admin.from('customer_tenant_links').delete().eq('customer_id', customerId);
    await options.admin.from('customers').delete().eq('id', customerId);
    await options.admin.from('customer_identities').delete().eq('id', identityId);
    return { ok: false, error: propertyInsert.error.message };
  }

  return { ok: true, customerId };
}
