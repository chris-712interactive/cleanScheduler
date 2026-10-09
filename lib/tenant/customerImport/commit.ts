import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { syncedFullNameFromParts } from '@/lib/tenant/customerIdentityName';
import type { CustomerImportDisposition } from '@/lib/tenant/customerImport/types';

type Admin = SupabaseClient<Database>;

const BATCH_SIZE = 50;

export type CustomerImportWriteResult = {
  created: number;
  propertiesAdded: number;
  failed: number;
  createdCustomerIds: string[];
  error?: string;
};

async function deleteImportedCustomers(
  admin: Admin,
  customerIds: string[],
  identityIds: string[],
): Promise<void> {
  if (customerIds.length > 0) {
    await admin.from('tenant_customer_properties').delete().in('customer_id', customerIds);
    await admin.from('tenant_customer_profiles').delete().in('customer_id', customerIds);
    await admin.from('customer_tenant_links').delete().in('customer_id', customerIds);
    await admin.from('customers').delete().in('id', customerIds);
  }
  if (identityIds.length > 0) {
    await admin.from('customer_identities').delete().in('id', identityIds);
  }
}

async function insertCreateBatch(
  admin: Admin,
  tenantId: string,
  batch: CustomerImportDisposition[],
): Promise<{ created: number; propertiesAdded: number; customerIds: string[]; error?: string }> {
  const prepared = batch.map((disposition) => {
    const identityId = randomUUID();
    const customerId = randomUUID();
    return { disposition, identityId, customerId };
  });

  const identityInsert = await admin.from('customer_identities').insert(
    prepared.map(({ disposition, identityId }) => ({
      id: identityId,
      email: disposition.draft.email,
      first_name: disposition.draft.firstName,
      last_name: disposition.draft.lastName,
      full_name: syncedFullNameFromParts(
        disposition.draft.firstName,
        disposition.draft.lastName ?? '',
      ),
      phone: disposition.draft.phone,
    })),
  );
  if (identityInsert.error) {
    return { created: 0, propertiesAdded: 0, customerIds: [], error: identityInsert.error.message };
  }

  const customerInsert = await admin.from('customers').insert(
    prepared.map(({ disposition, identityId, customerId }) => ({
      id: customerId,
      tenant_id: tenantId,
      customer_identity_id: identityId,
      external_ref: disposition.draft.externalRef,
      status: disposition.draft.status,
      imported_at: new Date().toISOString(),
    })),
  );
  if (customerInsert.error) {
    await deleteImportedCustomers(
      admin,
      [],
      prepared.map((row) => row.identityId),
    );
    return { created: 0, propertiesAdded: 0, customerIds: [], error: customerInsert.error.message };
  }

  const linkInsert = await admin.from('customer_tenant_links').insert(
    prepared.map(({ identityId, customerId }) => ({
      customer_identity_id: identityId,
      tenant_id: tenantId,
      customer_id: customerId,
      is_primary: true,
    })),
  );
  if (linkInsert.error) {
    await deleteImportedCustomers(
      admin,
      prepared.map((row) => row.customerId),
      prepared.map((row) => row.identityId),
    );
    return { created: 0, propertiesAdded: 0, customerIds: [], error: linkInsert.error.message };
  }

  const profileInsert = await admin.from('tenant_customer_profiles').insert(
    prepared.map(({ disposition, customerId }) => ({
      tenant_id: tenantId,
      customer_id: customerId,
      company_name: disposition.draft.companyName,
      internal_notes: disposition.draft.internalNotes,
      preferred_payment_method: 'card' as const,
      marketing_email_opt_in: false,
      sms_transactional_opt_in: false,
    })),
  );
  if (profileInsert.error) {
    await deleteImportedCustomers(
      admin,
      prepared.map((row) => row.customerId),
      prepared.map((row) => row.identityId),
    );
    return { created: 0, propertiesAdded: 0, customerIds: [], error: profileInsert.error.message };
  }

  const propertyRows = prepared.flatMap(({ disposition, customerId }) =>
    disposition.propertiesToAdd.map((property) => ({
      tenant_id: tenantId,
      customer_id: customerId,
      label: property.label,
      property_kind: property.kind,
      address_line1: property.addressLine1,
      address_line2: property.addressLine2,
      city: property.city,
      state: property.state,
      postal_code: property.postalCode,
      site_notes: property.siteNotes,
      is_primary: property.isPrimary,
    })),
  );

  if (propertyRows.length > 0) {
    const propertyInsert = await admin.from('tenant_customer_properties').insert(propertyRows);
    if (propertyInsert.error) {
      await deleteImportedCustomers(
        admin,
        prepared.map((row) => row.customerId),
        prepared.map((row) => row.identityId),
      );
      return {
        created: 0,
        propertiesAdded: 0,
        customerIds: [],
        error: propertyInsert.error.message,
      };
    }
  }

  return {
    created: prepared.length,
    propertiesAdded: propertyRows.length,
    customerIds: prepared.map((row) => row.customerId),
  };
}

export async function commitCustomerImport(input: {
  admin: Admin;
  tenantId: string;
  dispositions: CustomerImportDisposition[];
}): Promise<CustomerImportWriteResult> {
  const creates = input.dispositions.filter((row) => row.action === 'create');
  const propertyAdds = input.dispositions.filter((row) => row.action === 'add_properties');
  let created = 0;
  let propertiesAdded = 0;
  let failed = 0;
  const createdCustomerIds: string[] = [];
  let error: string | undefined;

  for (let index = 0; index < creates.length; index += BATCH_SIZE) {
    const batch = creates.slice(index, index + BATCH_SIZE);
    const result = await insertCreateBatch(input.admin, input.tenantId, batch);
    created += result.created;
    propertiesAdded += result.propertiesAdded;
    if (result.error) {
      failed += batch.length;
      error = result.error;
    } else {
      createdCustomerIds.push(...result.customerIds);
    }
  }

  const propertyRows = propertyAdds.flatMap((disposition) =>
    disposition.propertiesToAdd.map((property) => ({
      tenant_id: input.tenantId,
      customer_id: disposition.matchedCustomerId!,
      label: property.label,
      property_kind: property.kind,
      address_line1: property.addressLine1,
      address_line2: property.addressLine2,
      city: property.city,
      state: property.state,
      postal_code: property.postalCode,
      site_notes: property.siteNotes,
      is_primary: property.isPrimary,
    })),
  );

  for (let index = 0; index < propertyRows.length; index += BATCH_SIZE) {
    const batch = propertyRows.slice(index, index + BATCH_SIZE);
    const insert = await input.admin.from('tenant_customer_properties').insert(batch);
    if (insert.error) {
      failed += batch.length;
      error = insert.error.message;
    } else {
      propertiesAdded += batch.length;
    }
  }

  return { created, propertiesAdded, failed, createdCustomerIds, error };
}
