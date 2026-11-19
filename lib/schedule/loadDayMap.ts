import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { dbOverlapRangeForQuery } from '@/lib/tenant/scheduleDateRange';
import { shapeDayMap, type DayMapModel, type DayMapVisitRow } from '@/lib/schedule/dayMap';

export const DAY_MAP_VISIT_SELECT = `
  id,
  tenant_id,
  customer_id,
  property_id,
  title,
  starts_at,
  ends_at,
  status,
  customers (
    customer_identities (
      first_name,
      last_name,
      full_name
    ),
    tenant_customer_properties (
      tenant_id,
      is_primary,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      latitude,
      longitude,
      geocode_reason
    )
  ),
  tenant_customer_properties (
    tenant_id,
    is_primary,
    address_line1,
    address_line2,
    city,
    state,
    postal_code,
    latitude,
    longitude,
    geocode_reason
  ),
  tenant_scheduled_visit_assignees (
    user_id,
    user_profiles (
      display_name
    )
  )
`;

export async function loadDayMap(params: {
  supabase: SupabaseClient<Database>;
  tenantId: string;
  dateKey: string;
  timeZone: string;
}): Promise<DayMapModel> {
  const tenantId = params.tenantId.trim();
  if (!tenantId) {
    throw new Error('A workspace is required to load the day map.');
  }

  const range = dbOverlapRangeForQuery('day', params.dateKey);
  const { data, error } = await params.supabase
    .from('tenant_scheduled_visits')
    .select(DAY_MAP_VISIT_SELECT)
    .eq('tenant_id', tenantId)
    .neq('status', 'cancelled')
    .lte('starts_at', range.end)
    .gte('ends_at', range.start)
    .order('starts_at', { ascending: true })
    .overrideTypes<DayMapVisitRow[], { merge: false }>();

  if (error) {
    throw new Error(error.message);
  }

  return shapeDayMap({
    tenantId,
    dateKey: params.dateKey,
    timeZone: params.timeZone,
    rows: data ?? [],
  });
}
