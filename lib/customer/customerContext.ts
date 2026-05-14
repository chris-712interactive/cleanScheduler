import { createAdminClient } from '@/lib/supabase/server';

export interface CustomerTenantLink {
  linkId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  customerId: string;
  isPrimary: boolean;
}

export interface CustomerPortalContext {
  customerIdentityId: string;
  links: CustomerTenantLink[];
  customerIds: string[];
}

/**
 * Resolves the signed-in user's global customer identity and every linked
 * tenant customer row. Used with the service-role client and explicit
 * `customer_id` / `customer_identity_id` filters (RLS does not expose these
 * rows to the `customer` app role yet).
 */
export async function getCustomerPortalContext(
  userId: string,
): Promise<CustomerPortalContext | null> {
  const admin = createAdminClient();
  const { data: identity, error: idErr } = await admin
    .from('customer_identities')
    .select('id')
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (idErr || !identity) return null;

  const { data: linksRaw, error: linkErr } = await admin
    .from('customer_tenant_links')
    .select(
      `
      id,
      tenant_id,
      customer_id,
      is_primary,
      tenants:tenants!inner ( id, slug, name )
    `,
    )
    .eq('customer_identity_id', identity.id);

  if (linkErr || !linksRaw?.length) {
    return {
      customerIdentityId: identity.id,
      links: [],
      customerIds: [],
    };
  }

  const links: CustomerTenantLink[] = linksRaw
    .map((row) => {
      const tenants = row.tenants as { id: string; slug: string; name: string } | null;
      if (!tenants) return null;
      return {
        linkId: row.id,
        tenantId: row.tenant_id,
        tenantSlug: tenants.slug,
        tenantName: tenants.name,
        customerId: row.customer_id,
        isPrimary: row.is_primary,
      };
    })
    .filter((x): x is CustomerTenantLink => x !== null);

  const customerIds = [...new Set(links.map((l) => l.customerId))];

  return {
    customerIdentityId: identity.id,
    links,
    customerIds,
  };
}
