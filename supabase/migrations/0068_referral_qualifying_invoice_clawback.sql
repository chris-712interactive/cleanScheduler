-- =============================================================================
-- 0068_referral_qualifying_invoice_clawback.sql
-- Track qualifying invoice for clawbacks; mark reversed reward events.
-- =============================================================================

alter table public.referral_attributions
  add column if not exists qualifying_invoice_id uuid references public.tenant_invoices (id) on delete set null;

create index if not exists referral_attributions_qualifying_invoice_idx
  on public.referral_attributions (qualifying_invoice_id)
  where qualifying_invoice_id is not null;

comment on column public.referral_attributions.qualifying_invoice_id is
  'First paid invoice that qualified this referral; used for refund clawbacks.';

alter table public.referral_reward_events
  add column if not exists clawed_back_at timestamptz;

comment on column public.referral_reward_events.clawed_back_at is
  'When wallet credit from this reward was reversed (refund or staff void).';
