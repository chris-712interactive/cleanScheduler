-- =============================================================================
-- 0087_consultation_checklist_and_notes.sql
-- Per–service-type consultation checklists + visit link for quoting walkthroughs.
-- =============================================================================

alter table public.tenant_service_templates
  add column if not exists consultation_checklist_items jsonb not null default '[]'::jsonb;

comment on column public.tenant_service_templates.consultation_checklist_items is
  'Ordered consultation walkthrough checklist items [{id, label}] (max ~20). Separate from crew checklist_items.';

alter table public.tenant_scheduled_visits
  add column if not exists consultation_service_template_id uuid null
    references public.tenant_service_templates (id) on delete set null;

comment on column public.tenant_scheduled_visits.consultation_service_template_id is
  'Service type the consultation is for; used to resolve consultation_checklist_items.';

create index if not exists tenant_scheduled_visits_consultation_template_idx
  on public.tenant_scheduled_visits (tenant_id, consultation_service_template_id)
  where consultation_service_template_id is not null;
