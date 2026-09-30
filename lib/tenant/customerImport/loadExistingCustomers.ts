import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { normalizePhoneToE164 } from '@/lib/sms/normalizePhoneNumber';
import type { ExistingCustomerRecord } from '@/lib/tenant/customerImport/types';

type Admin = SupabaseClient<Database>;

const PAGE_SIZE = 1000;

type IdentityJoin = {
  email: string | null;
  phone: string | null;
  last_name: string | null;
};

function oneIdentity(value: IdentityJoin | IdentityJoin[] | null): IdentityJoin | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export async function loadExistingCustomersForImport(
  admin: Admin,
  tenantId: string,
): Promise<ExistingCustomerRecord[]> {
  const records: ExistingCustomerRecord[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await admin
      .from('customers')
      .select(
        `
        id,
        external_ref,
        customer_identities (
          email,
          phone,
          last_name
        ),
        tenant_customer_properties (
          address_line1,
          postal_code
        )
      `,
      )
      .eq('tenant_id', tenantId)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = data ?? [];
    for (const row of rows) {
      const identity = oneIdentity(row.customer_identities as IdentityJoin | IdentityJoin[] | null);
      const properties = Array.isArray(row.tenant_customer_properties)
        ? row.tenant_customer_properties
        : [];
      records.push({
        customerId: row.id,
        externalRef: row.external_ref,
        email: identity?.email ?? null,
        phone: identity?.phone ? (normalizePhoneToE164(identity.phone) ?? identity.phone) : null,
        lastName: identity?.last_name ?? null,
        properties: properties.map((property) => ({
          addressLine1: property.address_line1,
          postalCode: property.postal_code,
        })),
      });
    }

    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return records;
}
