-- =============================================================================
-- 0067_invoice_promotions_referral_audit.sql
-- Invoice promo/wallet columns, redemption invoice link, manual referral source.
-- =============================================================================

create type public.referral_attribution_source as enum ('link', 'manual');

alter table public.tenant_invoices
  add column if not exists applied_promotion_id uuid references public.tenant_promotions (id) on delete set null,
  add column if not exists applied_promo_code text,
  add column if not exists promo_discount_cents bigint not null default 0,
  add column if not exists wallet_credit_applied_cents bigint not null default 0;

alter table public.tenant_invoices
  add constraint tenant_invoices_promo_discount_nonneg check (promo_discount_cents >= 0);

alter table public.tenant_invoices
  add constraint tenant_invoices_wallet_credit_nonneg check (wallet_credit_applied_cents >= 0);

comment on column public.tenant_invoices.applied_promotion_id is
  'Customer-applied promo code before online payment.';
comment on column public.tenant_invoices.promo_discount_cents is
  'Promo discount reserved against the unpaid balance at checkout.';
comment on column public.tenant_invoices.wallet_credit_applied_cents is
  'Wallet credit reserved against the unpaid balance at checkout.';

alter table public.tenant_promotion_redemptions
  add column if not exists invoice_id uuid references public.tenant_invoices (id) on delete set null;

create index if not exists tenant_promotion_redemptions_invoice_idx
  on public.tenant_promotion_redemptions (invoice_id)
  where invoice_id is not null;

alter table public.referral_attributions
  add column if not exists attribution_source public.referral_attribution_source not null default 'link';

comment on column public.referral_attributions.attribution_source is
  'link = captured from referral URL; manual = staff attributed on customer record.';
