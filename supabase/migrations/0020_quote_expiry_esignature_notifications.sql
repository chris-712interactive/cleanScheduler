-- =============================================================================
-- 0020_quote_expiry_esignature_notifications.sql
-- =============================================================================
-- Sent quotes past valid_until -> expired (batch function; schedule pg_cron in
-- Supabase Dashboard if available). Immutable expired rows. E-signature required
-- before status -> accepted. Notification prefs + SMS placeholders on operational
-- settings. customer_id NOT NULL on tenant_quotes. Atomic quote create RPC.

-- -----------------------------------------------------------------------------
-- 1. Operational settings: email + SMS notification toggles
-- -----------------------------------------------------------------------------

alter table public.tenant_operational_settings
  add column if not exists email_notify_quote_sent boolean not null default true,
  add column if not exists email_notify_quote_accepted boolean not null default true,
  add column if not exists email_notify_quote_declined boolean not null default true,
  add column if not exists sms_notify_quote_sent boolean not null default false,
  add column if not exists sms_notify_quote_accepted boolean not null default false,
  add column if not exists sms_notify_quote_declined boolean not null default false;

comment on column public.tenant_operational_settings.sms_notify_quote_sent is
  'Reserved for future Twilio SMS; not enforced by app yet.';
comment on column public.tenant_operational_settings.sms_notify_quote_accepted is
  'Reserved for future Twilio SMS; not enforced by app yet.';
comment on column public.tenant_operational_settings.sms_notify_quote_declined is
  'Reserved for future Twilio SMS; not enforced by app yet.';

-- -----------------------------------------------------------------------------
-- 2. E-signature (typed name or drawn PNG base64) before acceptance
-- -----------------------------------------------------------------------------

create type public.quote_acceptance_signature_kind as enum (
  'typed_name',
  'drawn_png'
);

create table public.tenant_quote_acceptance_e_signatures (
  quote_id uuid primary key references public.tenant_quotes(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  signer_auth_user_id uuid,
  signature_kind public.quote_acceptance_signature_kind not null,
  typed_full_name text,
  drawn_png_base64 text,
  client_ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint tenant_quote_e_sign_drawn_size
    check (
      signature_kind is distinct from 'drawn_png'::public.quote_acceptance_signature_kind
      or (
        drawn_png_base64 is not null
        and length(drawn_png_base64) >= 200
        and length(drawn_png_base64) <= 900000
      )
    ),
  constraint tenant_quote_e_sign_typed
    check (
      signature_kind is distinct from 'typed_name'::public.quote_acceptance_signature_kind
      or (
        typed_full_name is not null
        and length(trim(typed_full_name)) >= 2
        and length(trim(typed_full_name)) <= 500
      )
    )
);

create index tenant_quote_e_signatures_tenant_idx
  on public.tenant_quote_acceptance_e_signatures (tenant_id);

create or replace function public.tenant_quote_e_signatures_fill_tenant()
returns trigger
language plpgsql
as $$
declare
  tid uuid;
begin
  select q.tenant_id into tid from public.tenant_quotes q where q.id = new.quote_id;
  if tid is null then
    raise exception 'tenant_quote_acceptance_e_signatures: quote not found';
  end if;
  new.tenant_id := tid;
  return new;
end;
$$;

create trigger tenant_quote_e_signatures_fill_tenant
before insert on public.tenant_quote_acceptance_e_signatures
for each row execute procedure public.tenant_quote_e_signatures_fill_tenant();

alter table public.tenant_quote_acceptance_e_signatures enable row level security;

create policy "tenant_quote_e_signatures_member_read"
  on public.tenant_quote_acceptance_e_signatures
  for select
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

create policy "tenant_quote_e_signatures_member_write"
  on public.tenant_quote_acceptance_e_signatures
  for all
  using (public.is_platform_admin() or public.has_tenant_membership(tenant_id))
  with check (public.is_platform_admin() or public.has_tenant_membership(tenant_id));

revoke all on table public.tenant_quote_acceptance_e_signatures from anon;
revoke all on table public.tenant_quote_acceptance_e_signatures from authenticated;
grant select, insert, update, delete on table public.tenant_quote_acceptance_e_signatures to service_role;

-- -----------------------------------------------------------------------------
-- 3. Require e-signature row before first transition to accepted
-- -----------------------------------------------------------------------------

create or replace function public.tenant_quotes_require_e_signature_before_accept()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and new.status = 'accepted'::public.quote_status
     and old.status is distinct from 'accepted'::public.quote_status
     and not exists (
       select 1
       from public.tenant_quote_acceptance_e_signatures s
       where s.quote_id = new.id
     )
  then
    raise exception 'QUOTE_ACCEPT_REQUIRES_ESIGNATURE';
  end if;
  return new;
end;
$$;

create trigger tenant_quotes_06_require_e_signature_before_accept
before update of status on public.tenant_quotes
for each row execute procedure public.tenant_quotes_require_e_signature_before_accept();

-- -----------------------------------------------------------------------------
-- 4. Expired quotes are immutable (no updates)
-- -----------------------------------------------------------------------------

create or replace function public.tenant_quotes_reject_mutations_when_expired()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'expired'::public.quote_status then
    raise exception 'QUOTE_EXPIRED_IMMUTABLE';
  end if;
  return new;
end;
$$;

create trigger tenant_quotes_07_reject_mutations_when_expired
before update on public.tenant_quotes
for each row execute procedure public.tenant_quotes_reject_mutations_when_expired();

-- Order: 07 runs on UPDATE; 06 runs on UPDATE of status — trigger order may matter.
-- PostgreSQL fires BEFORE triggers alphabetically by name by default? Actually by creation order.
-- 06 runs before 07 if 06 created first — we need e-signature check before expired check.
-- For status change to accepted on non-expired quote, both pass. For update on expired, 07 raises.

-- -----------------------------------------------------------------------------
-- 5. Auto-expire sent quotes past valid_until (invoke hourly via pg_cron or external worker)
-- -----------------------------------------------------------------------------

create or replace function public.expire_sent_quotes_past_valid_until()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.tenant_quotes q
  set status = 'expired'::public.quote_status
  where q.status = 'sent'::public.quote_status
    and q.valid_until is not null
    and q.valid_until < (timezone('utc', now()))
    and not q.is_locked;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.expire_sent_quotes_past_valid_until() from public;
grant execute on function public.expire_sent_quotes_past_valid_until() to service_role;

comment on function public.expire_sent_quotes_past_valid_until() is
  'Sets status to expired for sent quotes whose valid_until is in the past (UTC). Schedule hourly via pg_cron in Supabase Dashboard: select public.expire_sent_quotes_past_valid_until();';

-- -----------------------------------------------------------------------------
-- 6. customer_id required on tenant_quotes
-- -----------------------------------------------------------------------------

delete from public.tenant_quote_line_items li
where exists (
  select 1 from public.tenant_quotes q
  where q.id = li.quote_id
    and q.customer_id is null
);

delete from public.tenant_quote_acceptance_snapshots s
where exists (
  select 1 from public.tenant_quotes q where q.id = s.quote_id and q.customer_id is null
);

delete from public.tenant_quotes where customer_id is null;

alter table public.tenant_quotes
  alter column customer_id set not null;

-- -----------------------------------------------------------------------------
-- 7. Atomic create: header + line items in one transaction
-- -----------------------------------------------------------------------------

create or replace function public.tenant_quote_create_with_line_items(
  p_tenant_id uuid,
  p_customer_id uuid,
  p_property_id uuid,
  p_title text,
  p_status public.quote_status,
  p_amount_cents bigint,
  p_notes text,
  p_valid_until timestamptz,
  p_tax_mode public.quote_tax_mode,
  p_tax_rate_bps int,
  p_quote_discount_kind public.quote_discount_kind,
  p_quote_discount_value bigint,
  p_line_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  rec record;
  ord int := 0;
begin
  if not exists (
    select 1 from public.customers c where c.id = p_customer_id and c.tenant_id = p_tenant_id
  ) then
    raise exception 'CUSTOMER_NOT_IN_TENANT';
  end if;

  if p_property_id is not null then
    if not exists (
      select 1
      from public.tenant_customer_properties p
      where p.id = p_property_id
        and p.tenant_id = p_tenant_id
        and p.customer_id = p_customer_id
    ) then
      raise exception 'PROPERTY_NOT_FOR_CUSTOMER';
    end if;
  end if;

  insert into public.tenant_quotes (
    tenant_id,
    customer_id,
    property_id,
    title,
    status,
    amount_cents,
    notes,
    valid_until,
    tax_mode,
    tax_rate_bps,
    quote_discount_kind,
    quote_discount_value
  )
  values (
    p_tenant_id,
    p_customer_id,
    p_property_id,
    p_title,
    p_status,
    p_amount_cents,
    p_notes,
    p_valid_until,
    p_tax_mode,
    p_tax_rate_bps,
    p_quote_discount_kind,
    p_quote_discount_value
  )
  returning id into new_id;

  for rec in
    select t.value as doc
    from jsonb_array_elements(coalesce(p_line_items, '[]'::jsonb)) as t(value)
  loop
    insert into public.tenant_quote_line_items (
      quote_id,
      sort_order,
      service_label,
      frequency,
      frequency_detail,
      amount_cents,
      line_discount_kind,
      line_discount_value
    )
    values (
      new_id,
      coalesce((rec.doc->>'sort_order')::int, ord),
      trim(rec.doc->>'service_label'),
      coalesce(
        (rec.doc->>'frequency')::public.quote_line_frequency,
        'one_time'::public.quote_line_frequency
      ),
      nullif(trim(rec.doc->>'frequency_detail'), ''),
      (rec.doc->>'amount_cents')::bigint,
      coalesce(
        (rec.doc->>'line_discount_kind')::public.quote_line_discount_kind,
        'none'::public.quote_line_discount_kind
      ),
      coalesce((rec.doc->>'line_discount_value')::bigint, 0)
    );
    ord := ord + 1;
  end loop;

  return new_id;
end;
$$;

revoke all on function public.tenant_quote_create_with_line_items(
  uuid, uuid, uuid, text, public.quote_status, bigint, text, timestamptz,
  public.quote_tax_mode, int, public.quote_discount_kind, bigint, jsonb
) from public;
grant execute on function public.tenant_quote_create_with_line_items(
  uuid, uuid, uuid, text, public.quote_status, bigint, text, timestamptz,
  public.quote_tax_mode, int, public.quote_discount_kind, bigint, jsonb
) to service_role;
