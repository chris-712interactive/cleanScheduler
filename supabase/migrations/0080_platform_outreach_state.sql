-- =============================================================================
-- 0080_platform_outreach_state.sql
-- Add state to outreach recipients for area tracking.
-- =============================================================================

alter table public.platform_outreach_recipients
  add column if not exists state text;

comment on column public.platform_outreach_recipients.state is
  'US state or region for geographic outreach tracking (e.g. FL).';

create index if not exists platform_outreach_recipients_campaign_area_idx
  on public.platform_outreach_recipients (campaign_id, state, county);
