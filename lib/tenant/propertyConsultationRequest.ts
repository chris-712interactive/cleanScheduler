import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';

type Admin = SupabaseClient<Database>;

export type PropertyConsultationPhase = 'none' | 'needs_scheduling' | 'scheduled' | 'completed';

type VisitStatus = 'scheduled' | 'completed' | 'cancelled' | string;

/** A customer-requested location stays in consultation until a visit there is completed. */
export function propertyConsultationPhase(
  requestedAt: string | null | undefined,
  visitStatuses: VisitStatus[],
): PropertyConsultationPhase {
  if (!requestedAt) return 'none';
  const open = visitStatuses.filter((status) => status !== 'cancelled');
  if (open.some((status) => status === 'completed')) return 'completed';
  if (open.some((status) => status === 'scheduled')) return 'scheduled';
  return 'needs_scheduling';
}

export type PropertyConsultationVisit = {
  id: string;
  propertyId: string;
  status: string;
  startsAt: string;
  endsAt: string;
};

export async function loadConsultationVisitsForProperties(
  admin: Admin,
  tenantId: string,
  propertyIds: string[],
): Promise<PropertyConsultationVisit[]> {
  if (propertyIds.length === 0) return [];
  const { data } = await admin
    .from('tenant_scheduled_visits')
    .select('id, property_id, status, starts_at, ends_at')
    .eq('tenant_id', tenantId)
    .eq('visit_purpose', 'consultation')
    .neq('status', 'cancelled')
    .in('property_id', propertyIds)
    .order('starts_at', { ascending: true });

  return (data ?? [])
    .filter((row) => row.property_id)
    .map((row) => ({
      id: row.id,
      propertyId: row.property_id as string,
      status: row.status,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
    }));
}

export type PropertyConsultationPrompt = {
  phase: Exclude<PropertyConsultationPhase, 'none' | 'completed'>;
  visitId: string | null;
  startsAt: string | null;
  endsAt: string | null;
};

export async function loadPropertyConsultationPrompts(
  admin: Admin,
  tenantId: string,
  properties: Array<{ id: string; consultation_requested_at: string | null }>,
): Promise<Record<string, PropertyConsultationPrompt>> {
  const requested = properties.filter((property) => property.consultation_requested_at);
  const visits = await loadConsultationVisitsForProperties(
    admin,
    tenantId,
    requested.map((property) => property.id),
  );
  const prompts: Record<string, PropertyConsultationPrompt> = {};
  for (const property of requested) {
    const propertyVisits = visits.filter((visit) => visit.propertyId === property.id);
    const phase = propertyConsultationPhase(
      property.consultation_requested_at,
      propertyVisits.map((visit) => visit.status),
    );
    if (phase !== 'needs_scheduling' && phase !== 'scheduled') continue;
    const next = propertyVisits.find((visit) => visit.status === 'scheduled') ?? null;
    prompts[property.id] = {
      phase,
      visitId: next?.id ?? null,
      startsAt: next?.startsAt ?? null,
      endsAt: next?.endsAt ?? null,
    };
  }
  return prompts;
}

export async function customerHasOpenPropertyConsultation(
  admin: Admin,
  customerIds: string[],
): Promise<boolean> {
  if (customerIds.length === 0) return false;
  const { data: properties } = await admin
    .from('tenant_customer_properties')
    .select('id, tenant_id, consultation_requested_at')
    .in('customer_id', customerIds)
    .not('consultation_requested_at', 'is', null);
  const rows = properties ?? [];
  if (rows.length === 0) return false;

  const tenantIds = [...new Set(rows.map((row) => row.tenant_id))];
  const visits = (
    await Promise.all(
      tenantIds.map((tenantId) =>
        loadConsultationVisitsForProperties(
          admin,
          tenantId,
          rows.filter((row) => row.tenant_id === tenantId).map((row) => row.id),
        ),
      ),
    )
  ).flat();

  return rows.some((row) => {
    const statuses = visits
      .filter((visit) => visit.propertyId === row.id)
      .map((visit) => visit.status);
    const phase = propertyConsultationPhase(row.consultation_requested_at, statuses);
    return phase === 'needs_scheduling' || phase === 'scheduled';
  });
}

export async function countPropertiesNeedingConsultation(
  admin: Admin,
  tenantId: string,
): Promise<number> {
  const { data: properties } = await admin
    .from('tenant_customer_properties')
    .select('id, consultation_requested_at')
    .eq('tenant_id', tenantId)
    .not('consultation_requested_at', 'is', null);

  const rows = properties ?? [];
  if (rows.length === 0) return 0;
  const visits = await loadConsultationVisitsForProperties(
    admin,
    tenantId,
    rows.map((row) => row.id),
  );
  return rows.filter((row) => {
    const statuses = visits
      .filter((visit) => visit.propertyId === row.id)
      .map((visit) => visit.status);
    return (
      propertyConsultationPhase(row.consultation_requested_at, statuses) === 'needs_scheduling'
    );
  }).length;
}

export type PropertyConsultationCustomer = {
  customerId: string;
  displayName: string;
  addressLine: string;
};

export async function loadCustomersNeedingPropertyConsultation(
  admin: Admin,
  tenantId: string,
): Promise<PropertyConsultationCustomer[]> {
  const { data: properties } = await admin
    .from('tenant_customer_properties')
    .select(
      `
      id,
      customer_id,
      label,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      consultation_requested_at,
      customers (
        status,
        customer_identities ( first_name, last_name, full_name )
      )
    `,
    )
    .eq('tenant_id', tenantId)
    .not('consultation_requested_at', 'is', null);

  const rows = properties ?? [];
  if (rows.length === 0) return [];
  const visits = await loadConsultationVisitsForProperties(
    admin,
    tenantId,
    rows.map((row) => row.id),
  );

  const byCustomer = new Map<string, PropertyConsultationCustomer>();
  for (const row of rows) {
    const statuses = visits
      .filter((visit) => visit.propertyId === row.id)
      .map((visit) => visit.status);
    if (propertyConsultationPhase(row.consultation_requested_at, statuses) !== 'needs_scheduling') {
      continue;
    }
    const customer = row.customers as {
      status: string;
      customer_identities: {
        first_name: string | null;
        last_name: string | null;
        full_name: string | null;
      } | null;
    } | null;
    if (!customer || customer.status !== 'active') continue;
    if (byCustomer.has(row.customer_id)) continue;
    byCustomer.set(row.customer_id, {
      customerId: row.customer_id,
      displayName: customer.customer_identities
        ? formatCustomerDisplayName(customer.customer_identities)
        : 'Customer',
      addressLine: formatPropertyAddressLine(row),
    });
  }
  return [...byCustomer.values()];
}

export async function assertRequestedPropertyReadyForQuote(
  admin: Admin,
  tenantId: string,
  customerId: string,
  propertyId: string | null | undefined,
  requireConsultation: boolean,
): Promise<{ ok: true } | { ok: false; error: string; schedulePath: string }> {
  if (!requireConsultation || !propertyId) return { ok: true };

  const { data: property } = await admin
    .from('tenant_customer_properties')
    .select('id, consultation_requested_at')
    .eq('id', propertyId)
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .maybeSingle();

  if (!property?.consultation_requested_at) return { ok: true };

  const visits = await loadConsultationVisitsForProperties(admin, tenantId, [property.id]);
  const phase = propertyConsultationPhase(
    property.consultation_requested_at,
    visits.map((visit) => visit.status),
  );
  if (phase === 'completed' || phase === 'none') return { ok: true };

  const schedulePath = `/schedule/new?${new URLSearchParams({
    purpose: 'consultation',
    customer_id: customerId,
    property_id: property.id,
  }).toString()}`;
  const scheduled = visits.find((visit) => visit.status === 'scheduled');
  if (phase === 'scheduled') {
    return {
      ok: false,
      error:
        'This location has a consultation scheduled. Mark it complete before sending a quote for it.',
      schedulePath: scheduled ? `/schedule/${scheduled.id}` : schedulePath,
    };
  }
  return {
    ok: false,
    error:
      'This location was requested by the customer. Schedule a consultation and mark it complete before sending a quote.',
    schedulePath,
  };
}
