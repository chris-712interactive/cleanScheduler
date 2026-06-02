import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';
import {
  DEFAULT_JOB_TYPE_CATALOG,
  DEFAULT_JOB_TYPE_PROPERTY_KINDS,
  defaultHoursForJobType,
} from '@/lib/tenant/defaultJobTypeCatalog';

type Admin = SupabaseClient<Database>;

export type JobTypeCatalogEntry = {
  id: string;
  service_label: string;
  name: string;
  job_type: CustomerPropertyKind;
  estimated_hours: number;
  amount_cents: number | null;
  is_system_default: boolean;
  is_active: boolean;
  sort_order: number;
};

export async function ensureTenantJobTypeCatalog(admin: Admin, tenantId: string): Promise<void> {
  const { count } = await admin
    .from('tenant_service_templates')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('kind', 'service_line');

  if ((count ?? 0) > 0) return;

  const rows = DEFAULT_JOB_TYPE_CATALOG.flatMap((definition) =>
    DEFAULT_JOB_TYPE_PROPERTY_KINDS.map((propertyKind) => ({
      tenant_id: tenantId,
      kind: 'service_line' as const,
      name: definition.name,
      service_label: definition.serviceLabel,
      job_type: propertyKind,
      estimated_hours: defaultHoursForJobType(definition, propertyKind),
      is_system_default: true,
      is_active: true,
      sort_order: definition.sortOrder,
    })),
  );

  const { error } = await admin.from('tenant_service_templates').insert(rows);
  if (error) {
    console.error('[jobTypeCatalog] seed failed:', error.message);
  }
}

export async function loadJobTypeCatalog(
  admin: Admin,
  tenantId: string,
  options?: { propertyKind?: CustomerPropertyKind | null; activeOnly?: boolean },
): Promise<JobTypeCatalogEntry[]> {
  await ensureTenantJobTypeCatalog(admin, tenantId);

  let query = admin
    .from('tenant_service_templates')
    .select(
      'id, service_label, name, job_type, estimated_hours, amount_cents, is_system_default, is_active, sort_order',
    )
    .eq('tenant_id', tenantId)
    .eq('kind', 'service_line')
    .not('job_type', 'is', null)
    .order('sort_order')
    .order('service_label');

  if (options?.activeOnly !== false) {
    query = query.eq('is_active', true);
  }

  if (options?.propertyKind) {
    query = query.eq('job_type', options.propertyKind);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[jobTypeCatalog] load failed:', error.message);
    return [];
  }

  return (data ?? [])
    .filter((row) => row.job_type && row.estimated_hours != null && row.service_label)
    .map((row) => ({
      id: row.id,
      service_label: row.service_label!,
      name: row.name,
      job_type: row.job_type as CustomerPropertyKind,
      estimated_hours: Number(row.estimated_hours),
      amount_cents: row.amount_cents,
      is_system_default: row.is_system_default ?? false,
      is_active: row.is_active,
      sort_order: row.sort_order,
    }));
}

export function findCatalogEntry(
  catalog: JobTypeCatalogEntry[],
  input: {
    serviceTemplateId?: string | null;
    serviceLabel?: string | null;
    propertyKind?: CustomerPropertyKind | null;
  },
): JobTypeCatalogEntry | null {
  if (input.serviceTemplateId) {
    const byId = catalog.find((entry) => entry.id === input.serviceTemplateId);
    if (byId) return byId;
  }

  const label = input.serviceLabel?.trim().toLowerCase();
  if (!label) return null;

  const matches = catalog.filter((entry) => entry.service_label.trim().toLowerCase() === label);
  if (matches.length === 0) return null;

  if (input.propertyKind) {
    const byKind = matches.find((entry) => entry.job_type === input.propertyKind);
    if (byKind) return byKind;
  }

  return matches[0] ?? null;
}

export function resolveVisitDurationHours(input: {
  lineEstimatedHours?: number | null;
  catalogEntry?: JobTypeCatalogEntry | null;
  fallbackHours?: number;
}): number {
  if (input.lineEstimatedHours != null && input.lineEstimatedHours > 0) {
    return input.lineEstimatedHours;
  }
  if (input.catalogEntry?.estimated_hours != null && input.catalogEntry.estimated_hours > 0) {
    return input.catalogEntry.estimated_hours;
  }
  return input.fallbackHours ?? 2;
}
