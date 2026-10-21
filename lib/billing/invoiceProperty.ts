import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { formatPropertyAddressLine, formatVisitSiteLine } from '@/lib/tenant/formatPropertyAddress';

type Admin = SupabaseClient<Database>;

type PropertyAddress = {
  label: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
};

export function invoicePropertyLabel(property: PropertyAddress | null | undefined): string {
  if (!property) return '';
  return formatVisitSiteLine(property.label, formatPropertyAddressLine(property));
}

async function propertyIdForQuote(
  admin: Admin,
  tenantId: string,
  customerId: string,
  quoteId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('tenant_quotes')
    .select('property_id')
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .maybeSingle();
  return data?.property_id ?? null;
}

/**
 * Property for a new invoice when the form did not pick one: the visit's
 * location, then the quote's location, then the customer's only property.
 */
export async function inferInvoicePropertyId(
  admin: Admin,
  params: {
    tenantId: string;
    customerId: string;
    visitId?: string | null;
    quoteId?: string | null;
  },
): Promise<string | null> {
  if (params.visitId) {
    const { data: visit } = await admin
      .from('tenant_scheduled_visits')
      .select('property_id, quote_id')
      .eq('id', params.visitId)
      .eq('tenant_id', params.tenantId)
      .eq('customer_id', params.customerId)
      .maybeSingle();
    if (visit?.property_id) return visit.property_id;
    if (visit?.quote_id) {
      const fromVisitQuote = await propertyIdForQuote(
        admin,
        params.tenantId,
        params.customerId,
        visit.quote_id,
      );
      if (fromVisitQuote) return fromVisitQuote;
    }
  }

  if (params.quoteId) {
    const fromQuote = await propertyIdForQuote(
      admin,
      params.tenantId,
      params.customerId,
      params.quoteId,
    );
    if (fromQuote) return fromQuote;
  }

  const { data: properties } = await admin
    .from('tenant_customer_properties')
    .select('id')
    .eq('tenant_id', params.tenantId)
    .eq('customer_id', params.customerId)
    .limit(2);

  if (properties?.length === 1) return properties[0]?.id ?? null;
  return null;
}

export async function loadInvoicePropertyLabels(
  admin: Admin,
  tenantId: string,
  propertyIds: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const ids = [...new Set(propertyIds.filter((id): id is string => Boolean(id)))];
  const labels = new Map<string, string>();
  if (ids.length === 0) return labels;

  const { data } = await admin
    .from('tenant_customer_properties')
    .select('id, label, address_line1, address_line2, city, state, postal_code')
    .eq('tenant_id', tenantId)
    .in('id', ids);

  for (const row of data ?? []) {
    const label = invoicePropertyLabel(row);
    if (label) labels.set(row.id, label);
  }
  return labels;
}
