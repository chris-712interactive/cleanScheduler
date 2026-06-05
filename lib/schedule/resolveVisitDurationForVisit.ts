import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  findCatalogEntry,
  loadJobTypeCatalog,
  resolveVisitDurationHours,
} from '@/lib/tenant/jobTypeCatalog';
import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';
import { DEFAULT_VISIT_DURATION_HOURS } from '@/lib/schedule/visitDuration';
import {
  consultationDurationMinutesToHours,
  formatConsultationDurationLabel,
  loadConsultationDurationMinutes,
} from '@/lib/tenant/consultationDuration';

type Admin = SupabaseClient<Database>;

export type VisitDurationResolution = {
  durationHours: number;
  sourceLabel: string;
};

export async function resolveVisitDurationForVisit(
  admin: Admin,
  tenantId: string,
  visitId: string,
): Promise<VisitDurationResolution | null> {
  const { data: visit, error } = await admin
    .from('tenant_scheduled_visits')
    .select(
      `
      id,
      title,
      quote_id,
      visit_purpose,
      quote_line_item_id,
      tenant_quotes (
        job_type,
        property_id
      )
    `,
    )
    .eq('id', visitId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !visit) return null;

  if (visit.visit_purpose === 'consultation') {
    const durationMinutes = await loadConsultationDurationMinutes(admin, tenantId);
    const durationHours = consultationDurationMinutesToHours(durationMinutes);
    return {
      durationHours,
      sourceLabel: `Consultation default (${formatConsultationDurationLabel(durationMinutes)})`,
    };
  }

  let lineEstimatedHours: number | null = null;
  let lineServiceLabel: string | null = null;
  let lineServiceTemplateId: string | null = null;

  if (visit.quote_line_item_id) {
    const { data: line } = await admin
      .from('tenant_quote_line_items')
      .select('service_label, estimated_hours, service_template_id')
      .eq('id', visit.quote_line_item_id)
      .maybeSingle();

    if (line) {
      lineEstimatedHours = line.estimated_hours;
      lineServiceLabel = line.service_label;
      lineServiceTemplateId = line.service_template_id;
    }
  }

  let propertyKind: CustomerPropertyKind | null =
    (visit.tenant_quotes?.job_type as CustomerPropertyKind | null) ?? null;

  const propertyId = visit.tenant_quotes?.property_id;
  if (!propertyKind && propertyId) {
    const { data: propertyRow } = await admin
      .from('tenant_customer_properties')
      .select('property_kind')
      .eq('id', propertyId)
      .maybeSingle();
    propertyKind = (propertyRow?.property_kind as CustomerPropertyKind | null) ?? null;
  }

  const catalog = await loadJobTypeCatalog(admin, tenantId, {
    propertyKind,
    activeOnly: true,
  });

  const catalogEntry = findCatalogEntry(catalog, {
    serviceTemplateId: lineServiceTemplateId,
    serviceLabel: lineServiceLabel ?? visit.title,
    propertyKind,
  });

  const durationHours = resolveVisitDurationHours({
    lineEstimatedHours,
    catalogEntry,
    fallbackHours: DEFAULT_VISIT_DURATION_HOURS,
  });

  let sourceLabel = `Default (${durationHours} hr)`;
  if (lineEstimatedHours != null && lineEstimatedHours > 0 && lineServiceLabel) {
    sourceLabel = `Quote line · ${lineServiceLabel.trim()} (${durationHours} hr)`;
  } else if (catalogEntry) {
    sourceLabel = `Service default · ${catalogEntry.service_label} (${durationHours} hr)`;
  }

  return { durationHours, sourceLabel };
}
