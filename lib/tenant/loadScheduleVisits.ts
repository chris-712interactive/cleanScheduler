import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@/lib/supabase/database.types';
import type { Database } from '@/lib/supabase/database.types';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';
import { resolveVisitSiteLine } from '@/lib/schedule/resolveVisitSiteLine';
import { normalizeAssigneeRows } from '@/lib/schedule/mapAssigneeChips';
import { isVisitAssignee } from '@/lib/schedule/visitFieldWork';
import {
  dbOverlapRangeForQuery,
  type ScheduleView,
  utcWeekDayKeys,
} from '@/lib/tenant/scheduleDateRange';
import type { ScheduleVisitVM } from '@/lib/tenant/scheduleVisitTypes';

type VisitListRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: Tables<'tenant_scheduled_visits'>['status'];
  notes: string | null;
  expected_amount_cents: number | null;
  customers: {
    customer_identities: {
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
      phone: string | null;
    } | null;
    tenant_customer_properties:
      | Pick<
          Tables<'tenant_customer_properties'>,
          'is_primary' | 'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code'
        >[]
      | null;
  } | null;
  tenant_customer_properties: Pick<
    Tables<'tenant_customer_properties'>,
    'address_line1' | 'address_line2' | 'city' | 'state' | 'postal_code'
  > | null;
  tenant_quotes: { title: string; amount_cents: number | null } | null;
  tenant_scheduled_visit_assignees:
    | {
        user_id: string;
        user_profiles: { display_name: string | null; avatar_url: string | null } | null;
      }[]
    | null;
};

function mapVisitRows(rows: VisitListRow[]): ScheduleVisitVM[] {
  return rows.map((v) => {
    const ident = v.customers?.customer_identities;
    const who =
      ident && customerHasAnyNameParts(ident) ? formatCustomerDisplayName(ident) : 'Customer';
    const site = resolveVisitSiteLine(
      v.tenant_customer_properties,
      v.customers?.tenant_customer_properties,
    );
    const assignees = normalizeAssigneeRows(
      v.tenant_scheduled_visit_assignees as Parameters<typeof normalizeAssigneeRows>[0],
    );
    return {
      id: v.id,
      title: v.title,
      starts_at: v.starts_at,
      ends_at: v.ends_at,
      status: v.status,
      notes: v.notes,
      customerName: who,
      customerPhone: ident?.phone?.trim() || null,
      siteLine: site,
      quoteTitle: v.tenant_quotes?.title ?? null,
      expectedAmountCents:
        v.expected_amount_cents != null && v.expected_amount_cents > 0
          ? v.expected_amount_cents
          : v.tenant_quotes?.amount_cents != null && v.tenant_quotes.amount_cents > 0
            ? v.tenant_quotes.amount_cents
            : null,
      assignees,
      assigneeUserIds: assignees.map((a) => a.userId),
    };
  });
}

export async function loadScheduleVisits(params: {
  supabase: SupabaseClient<Database>;
  tenantId: string;
  dateKey: string;
  view: ScheduleView;
  locationFilter?: string;
  fieldEmployeeMode?: boolean;
  currentUserId?: string;
}): Promise<{ visits: ScheduleVisitVM[]; weekDayKeys: string[] }> {
  const range = dbOverlapRangeForQuery(params.view, params.dateKey);
  const locationFilter = params.locationFilter?.trim() ?? '';

  let visitsQuery = params.supabase
    .from('tenant_scheduled_visits')
    .select(
      `
      id,
      title,
      starts_at,
      ends_at,
      status,
      notes,
      expected_amount_cents,
      customers (
        customer_identities (
          first_name,
          last_name,
          full_name,
          phone
        ),
        tenant_customer_properties (
          is_primary,
          address_line1,
          address_line2,
          city,
          state,
          postal_code
        )
      ),
      tenant_customer_properties (
        address_line1,
        address_line2,
        city,
        state,
        postal_code
      ),
      tenant_quotes (
        title,
        amount_cents
      ),
      tenant_scheduled_visit_assignees (
        user_id,
        user_profiles (
          display_name,
          avatar_url
        )
      )
    `,
    )
    .eq('tenant_id', params.tenantId)
    .lte('starts_at', range.end)
    .gte('ends_at', range.start)
    .order('starts_at', { ascending: true });

  if (locationFilter && locationFilter !== 'all') {
    visitsQuery = visitsQuery.eq('location_id', locationFilter);
  }

  const { data: visitRows, error: visitsErr } = await visitsQuery.overrideTypes<
    VisitListRow[],
    { merge: false }
  >();

  if (visitsErr) {
    throw new Error(visitsErr.message);
  }

  let visits = mapVisitRows(visitRows ?? []);

  if (params.fieldEmployeeMode && params.currentUserId) {
    visits = visits.filter((visit) =>
      isVisitAssignee(visit.assigneeUserIds, params.currentUserId!),
    );
  }

  return {
    visits,
    weekDayKeys: utcWeekDayKeys(params.dateKey),
  };
}
