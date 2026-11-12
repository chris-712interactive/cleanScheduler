import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';
import {
  capabilitiesForSegment,
  defaultPropertyKind,
  parseTenantServiceSegment,
  type SegmentCapabilities,
  type TenantServiceSegment,
} from '@/lib/tenant/serviceSegment';

export async function loadTenantServiceSegment(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<TenantServiceSegment> {
  const { data, error } = await admin
    .from('tenant_operational_settings')
    .select('service_segment')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data) return 'both';
  return parseTenantServiceSegment(data.service_segment);
}

export async function loadTenantSegmentCapabilities(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<SegmentCapabilities> {
  return capabilitiesForSegment(await loadTenantServiceSegment(admin, tenantId));
}

/** Property type used when a new customer, location, or consultation omits one. */
export async function defaultPropertyKindForTenant(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<CustomerPropertyKind> {
  return defaultPropertyKind(await loadTenantSegmentCapabilities(admin, tenantId));
}
