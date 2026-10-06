-- Tenant-chosen consultation intake fields. Empty means every answer is optional.

alter table public.tenant_operational_settings
  add column if not exists consultation_required_fields text[] not null default '{}';

comment on column public.tenant_operational_settings.consultation_required_fields is
  'Consultation intake field keys this company requires before a consultation can be completed. Empty means every field is optional.';
