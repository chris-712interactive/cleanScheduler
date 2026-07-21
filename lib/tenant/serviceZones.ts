import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { escapeIlikeMetacharacters } from '@/lib/tenant/customerDirectorySearch';

type Admin = SupabaseClient<Database>;

export type ServiceZoneOption = {
  id: string;
  name: string;
  is_active: boolean;
};

/** Active zones plus any currently assigned (possibly inactive) zone ids. */
export async function loadServiceZonesForAssignment(
  admin: Admin,
  tenantId: string,
  assignedZoneIds: Array<string | null | undefined> = [],
): Promise<ServiceZoneOption[]> {
  const includeIds = [...new Set(assignedZoneIds.filter((id): id is string => Boolean(id)))];

  const { data: active } = await admin
    .from('tenant_service_zones')
    .select('id, name, is_active')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  const byId = new Map<string, ServiceZoneOption>();
  for (const row of active ?? []) {
    byId.set(row.id, { id: row.id, name: row.name, is_active: row.is_active });
  }

  const missing = includeIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    const { data: extras } = await admin
      .from('tenant_service_zones')
      .select('id, name, is_active')
      .eq('tenant_id', tenantId)
      .in('id', missing);
    for (const row of extras ?? []) {
      byId.set(row.id, { id: row.id, name: row.name, is_active: row.is_active });
    }
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Validate a zone id for assignment.
 * Empty / missing → null. New assignment must be an active zone for this tenant.
 * When `allowInactiveIfCurrent` matches the submitted id, keep that inactive zone.
 */
export async function resolveAssignableServiceZoneId(
  admin: Admin,
  tenantId: string,
  rawZoneId: string,
  options?: { allowInactiveIfCurrent?: string | null },
): Promise<{ zoneId: string | null; error?: string }> {
  const zoneId = rawZoneId.trim();
  if (!zoneId) return { zoneId: null };

  const { data: zone, error } = await admin
    .from('tenant_service_zones')
    .select('id, is_active')
    .eq('tenant_id', tenantId)
    .eq('id', zoneId)
    .maybeSingle();

  if (error) return { zoneId: null, error: error.message };
  if (!zone) return { zoneId: null, error: 'Service zone not found in this workspace.' };

  const keepInactive = options?.allowInactiveIfCurrent === zone.id;
  if (!zone.is_active && !keepInactive) {
    return { zoneId: null, error: 'That service zone is inactive. Choose an active zone.' };
  }

  return { zoneId: zone.id };
}

/** Zone ids whose names match the search query (for directory text search). */
export async function findServiceZoneIdsByNameQuery(
  admin: Admin,
  tenantId: string,
  trimmedQuery: string,
): Promise<{ zoneIds: string[]; error: string | null }> {
  const pat = `%${escapeIlikeMetacharacters(trimmedQuery)}%`;
  const { data, error } = await admin
    .from('tenant_service_zones')
    .select('id')
    .eq('tenant_id', tenantId)
    .ilike('name', pat);

  if (error) return { zoneIds: [], error: error.message };
  return { zoneIds: (data ?? []).map((row) => row.id), error: null };
}

export function parseServiceZoneParam(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}
