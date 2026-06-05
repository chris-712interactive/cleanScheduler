import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';

type Admin = SupabaseClient<Database>;

export type ConsultationStatus = 'not_required' | 'needs_scheduling' | 'scheduled' | 'completed';

export type ConsultationVisitSummary = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: Database['public']['Enums']['visit_status'];
  title: string;
};

export type CustomerConsultationRow = {
  customerId: string;
  displayName: string;
  status: Exclude<ConsultationStatus, 'not_required' | 'completed'>;
  nextConsultation: ConsultationVisitSummary | null;
};

const CONSULTATION_VISIT_SELECT =
  'id, starts_at, ends_at, status, title, visit_purpose, customer_id, tenant_id';

export async function loadRequireConsultationBeforeQuote(
  admin: Admin,
  tenantId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('tenant_operational_settings')
    .select('require_consultation_before_quote')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return data?.require_consultation_before_quote ?? true;
}

export async function loadConsultationVisitsForCustomer(
  admin: Admin,
  tenantId: string,
  customerId: string,
): Promise<ConsultationVisitSummary[]> {
  const { data } = await admin
    .from('tenant_scheduled_visits')
    .select('id, starts_at, ends_at, status, title')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .eq('visit_purpose', 'consultation')
    .neq('status', 'cancelled')
    .order('starts_at', { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    title: row.title,
  }));
}

export function resolveConsultationStatusFromVisits(
  requireConsultation: boolean,
  visits: ConsultationVisitSummary[],
): ConsultationStatus {
  if (!requireConsultation) return 'not_required';
  if (visits.some((visit) => visit.status === 'completed')) return 'completed';
  if (visits.some((visit) => visit.status === 'scheduled')) return 'scheduled';
  return 'needs_scheduling';
}

export async function resolveCustomerConsultationStatus(
  admin: Admin,
  tenantId: string,
  customerId: string,
): Promise<{
  status: ConsultationStatus;
  requireConsultation: boolean;
  visits: ConsultationVisitSummary[];
  nextConsultation: ConsultationVisitSummary | null;
}> {
  const requireConsultation = await loadRequireConsultationBeforeQuote(admin, tenantId);
  const visits = requireConsultation
    ? await loadConsultationVisitsForCustomer(admin, tenantId, customerId)
    : [];
  const status = resolveConsultationStatusFromVisits(requireConsultation, visits);
  const nextConsultation =
    visits.find((visit) => visit.status === 'scheduled') ??
    visits.find((visit) => visit.status === 'completed') ??
    null;

  return { status, requireConsultation, visits, nextConsultation };
}

export async function customerHasCompletedConsultation(
  admin: Admin,
  tenantId: string,
  customerId: string,
): Promise<boolean> {
  const { status } = await resolveCustomerConsultationStatus(admin, tenantId, customerId);
  return status === 'not_required' || status === 'completed';
}

export function buildScheduleConsultationPath(
  customerId: string,
  propertyId?: string | null,
): string {
  const params = new URLSearchParams({
    purpose: 'consultation',
    customer_id: customerId,
  });
  if (propertyId) params.set('property_id', propertyId);
  return `/schedule/new?${params.toString()}`;
}

export async function assertCustomerEligibleForQuoteSend(
  admin: Admin,
  tenantId: string,
  customerId: string,
): Promise<{ ok: true } | { ok: false; error: string; schedulePath: string }> {
  const resolved = await resolveCustomerConsultationStatus(admin, tenantId, customerId);
  if (resolved.status === 'not_required' || resolved.status === 'completed') {
    return { ok: true };
  }

  const { data: property } = await admin
    .from('tenant_customer_properties')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .eq('is_primary', true)
    .maybeSingle();

  const schedulePath = buildScheduleConsultationPath(customerId, property?.id ?? null);

  if (resolved.status === 'needs_scheduling') {
    return {
      ok: false,
      error:
        'This customer needs a completed consultation before you can send a quote. Schedule a consultation first.',
      schedulePath,
    };
  }

  return {
    ok: false,
    error:
      'This customer has a consultation scheduled but it must be marked complete before you can send a quote.',
    schedulePath: resolved.nextConsultation
      ? `/schedule/${resolved.nextConsultation.id}`
      : schedulePath,
  };
}

export function consultationNeedsStaffAction(status: ConsultationStatus): boolean {
  return status === 'needs_scheduling' || status === 'scheduled';
}

export async function countCustomersNeedingConsultationAction(
  admin: Admin,
  tenantId: string,
): Promise<number> {
  const requireConsultation = await loadRequireConsultationBeforeQuote(admin, tenantId);
  if (!requireConsultation) return 0;

  const { data: customers } = await admin
    .from('customers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'active');

  const customerIds = (customers ?? []).map((row) => row.id);
  if (customerIds.length === 0) return 0;

  const { data: visits } = await admin
    .from('tenant_scheduled_visits')
    .select('customer_id, status')
    .eq('tenant_id', tenantId)
    .eq('visit_purpose', 'consultation')
    .neq('status', 'cancelled')
    .in('customer_id', customerIds);

  const completed = new Set<string>();
  for (const visit of visits ?? []) {
    if (visit.status === 'completed') completed.add(visit.customer_id);
  }

  let count = 0;
  for (const customerId of customerIds) {
    if (completed.has(customerId)) continue;
    count += 1;
  }
  return count;
}

export async function loadCustomersNeedingConsultation(
  admin: Admin,
  tenantId: string,
  limit = 50,
): Promise<CustomerConsultationRow[]> {
  const requireConsultation = await loadRequireConsultationBeforeQuote(admin, tenantId);
  if (!requireConsultation) return [];

  const { data: customers } = await admin
    .from('customers')
    .select(
      `
      id,
      customer_identities ( first_name, last_name, full_name )
    `,
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(200);

  if (!customers?.length) return [];

  const customerIds = customers.map((row) => row.id as string);
  const { data: visits } = await admin
    .from('tenant_scheduled_visits')
    .select(CONSULTATION_VISIT_SELECT)
    .eq('tenant_id', tenantId)
    .eq('visit_purpose', 'consultation')
    .neq('status', 'cancelled')
    .in('customer_id', customerIds)
    .order('starts_at', { ascending: true });

  const visitsByCustomer = new Map<string, ConsultationVisitSummary[]>();
  for (const row of visits ?? []) {
    const list = visitsByCustomer.get(row.customer_id) ?? [];
    list.push({
      id: row.id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
      title: row.title,
    });
    visitsByCustomer.set(row.customer_id, list);
  }

  const rows: CustomerConsultationRow[] = [];
  for (const customer of customers) {
    const customerId = customer.id as string;
    const customerVisits = visitsByCustomer.get(customerId) ?? [];
    const status = resolveConsultationStatusFromVisits(true, customerVisits);
    if (!consultationNeedsStaffAction(status)) continue;

    const identity = customer.customer_identities as {
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
    } | null;

    rows.push({
      customerId,
      displayName: identity ? formatCustomerDisplayName(identity) : 'Customer',
      status: status as Exclude<ConsultationStatus, 'not_required' | 'completed'>,
      nextConsultation: customerVisits.find((visit) => visit.status === 'scheduled') ?? null,
    });
    if (rows.length >= limit) break;
  }

  return rows;
}

export const CUSTOMERS_NEEDING_CONSULTATION_HREF = '/customers?consultation=needs_action';
