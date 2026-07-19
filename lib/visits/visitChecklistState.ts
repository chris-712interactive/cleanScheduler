import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';
import {
  instantiateVisitChecklist,
  parseChecklistTemplateItems,
  parseVisitChecklistItems,
  type ChecklistTemplateItem,
  type VisitChecklistItem,
} from '@/lib/visits/visitChecklist';

type Admin = SupabaseClient<Database>;

/** Pure resolver used by tests and the DB-backed loader. */
export function pickChecklistTemplateItems(input: {
  visitPurpose: string | null | undefined;
  consultationChecklistItems: unknown;
  serviceChecklistItems: unknown;
}): ChecklistTemplateItem[] {
  if (input.visitPurpose === 'consultation') {
    return parseChecklistTemplateItems(input.consultationChecklistItems);
  }
  return parseChecklistTemplateItems(input.serviceChecklistItems);
}

export async function resolveVisitChecklistTemplate(
  admin: Admin,
  params: { tenantId: string; visitId: string },
): Promise<ReturnType<typeof parseChecklistTemplateItems>> {
  const { data: visit } = await admin
    .from('tenant_scheduled_visits')
    .select('quote_line_item_id, visit_purpose, consultation_service_template_id')
    .eq('id', params.visitId)
    .eq('tenant_id', params.tenantId)
    .maybeSingle();

  if (!visit) return [];

  if (visit.visit_purpose === 'consultation') {
    if (!visit.consultation_service_template_id) return [];
    const { data: template } = await admin
      .from('tenant_service_templates')
      .select('consultation_checklist_items')
      .eq('id', visit.consultation_service_template_id)
      .eq('tenant_id', params.tenantId)
      .maybeSingle();

    return pickChecklistTemplateItems({
      visitPurpose: 'consultation',
      consultationChecklistItems: template?.consultation_checklist_items,
      serviceChecklistItems: null,
    });
  }

  if (!visit.quote_line_item_id) return [];

  const { data: line } = await admin
    .from('tenant_quote_line_items')
    .select('service_template_id')
    .eq('id', visit.quote_line_item_id)
    .maybeSingle();

  if (!line?.service_template_id) return [];

  const { data: template } = await admin
    .from('tenant_service_templates')
    .select('checklist_items')
    .eq('id', line.service_template_id)
    .eq('tenant_id', params.tenantId)
    .maybeSingle();

  return pickChecklistTemplateItems({
    visitPurpose: 'service',
    consultationChecklistItems: null,
    serviceChecklistItems: template?.checklist_items,
  });
}

/** Load or create visit checklist state from the service template. */
export async function ensureVisitChecklistState(
  admin: Admin,
  params: { tenantId: string; visitId: string },
): Promise<VisitChecklistItem[]> {
  const { data: existing } = await admin
    .from('tenant_visit_checklist_state')
    .select('items')
    .eq('tenant_id', params.tenantId)
    .eq('visit_id', params.visitId)
    .maybeSingle();

  if (existing) {
    return parseVisitChecklistItems(existing.items);
  }

  const template = await resolveVisitChecklistTemplate(admin, params);
  if (template.length === 0) return [];

  const items = instantiateVisitChecklist(template);
  await admin.from('tenant_visit_checklist_state').insert({
    tenant_id: params.tenantId,
    visit_id: params.visitId,
    items: items as unknown as Json,
    updated_at: new Date().toISOString(),
  });

  return items;
}

export async function toggleVisitChecklistItem(
  admin: Admin,
  params: { tenantId: string; visitId: string; itemId: string; done: boolean },
): Promise<VisitChecklistItem[] | { error: string }> {
  const items = await ensureVisitChecklistState(admin, params);
  if (items.length === 0) return { error: 'No checklist for this visit.' };

  const now = new Date().toISOString();
  const next = items.map((item) =>
    item.id === params.itemId
      ? { ...item, done: params.done, done_at: params.done ? now : null }
      : item,
  );

  const { error } = await admin.from('tenant_visit_checklist_state').upsert(
    {
      tenant_id: params.tenantId,
      visit_id: params.visitId,
      items: next as unknown as Json,
      updated_at: now,
    },
    { onConflict: 'tenant_id,visit_id' },
  );

  if (error) return { error: error.message };
  return next;
}
