-- One in-flight provider call per (tenant_id, idempotency_key, channel) across
-- serverless instances. The 45s wait can end while email, SMS, or a webhook
-- is still running. This lease stays held until that call settles, or until
-- lease_expires_at, which the app sets longer than a provider call can last.
-- provider_key is chosen once per step and reused, so a later retry collapses
-- at sent.dm, Resend, and the webhook delivery unique key.
--
-- Service role only. The app passes tenant_id from the authenticated membership,
-- never from user_metadata. Safe to re-run.

create table if not exists public.tenant_quote_channel_sends (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  idempotency_key uuid not null,
  channel text not null,
  state text not null,
  owner_token uuid not null,
  provider_key text not null,
  lease_expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, idempotency_key, channel)
);

alter table public.tenant_quote_channel_sends
  drop constraint if exists tenant_quote_channel_sends_request_fkey;

alter table public.tenant_quote_channel_sends
  add constraint tenant_quote_channel_sends_request_fkey
  foreign key (tenant_id, idempotency_key)
  references public.tenant_quote_create_requests (tenant_id, idempotency_key)
  on delete cascade;

alter table public.tenant_quote_channel_sends
  drop constraint if exists tenant_quote_channel_sends_channel_check;

alter table public.tenant_quote_channel_sends
  add constraint tenant_quote_channel_sends_channel_check
  check (channel in ('email', 'sms', 'webhook'));

alter table public.tenant_quote_channel_sends
  drop constraint if exists tenant_quote_channel_sends_state_check;

alter table public.tenant_quote_channel_sends
  add constraint tenant_quote_channel_sends_state_check
  check (state in ('sending', 'unknown', 'ok', 'failed'));

alter table public.tenant_quote_channel_sends
  drop constraint if exists tenant_quote_channel_sends_provider_key_check;

alter table public.tenant_quote_channel_sends
  add constraint tenant_quote_channel_sends_provider_key_check
  check (char_length(provider_key) between 1 and 255);

comment on table public.tenant_quote_channel_sends is
  'Cross-instance lease for one quote-create provider call. No customer secrets.';

comment on column public.tenant_quote_channel_sends.provider_key is
  'Stable per step. Retries reuse it so the provider can collapse a duplicate.';

comment on column public.tenant_quote_channel_sends.lease_expires_at is
  'sending and unknown cannot be claimed again until this time. ok is never reclaimed. failed can be claimed immediately.';

alter table public.tenant_quote_channel_sends enable row level security;

revoke all on table public.tenant_quote_channel_sends from anon;
revoke all on table public.tenant_quote_channel_sends from authenticated;
grant select, insert, update, delete on table public.tenant_quote_channel_sends to service_role;

create or replace function public.claim_quote_channel_send(
  p_tenant_id uuid,
  p_idempotency_key uuid,
  p_channel text,
  p_owner_token uuid,
  p_provider_key text,
  p_lease_expires_at timestamptz
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing public.tenant_quote_channel_sends%rowtype;
begin
  if p_channel not in ('email', 'sms', 'webhook')
     or p_provider_key is null
     or char_length(p_provider_key) < 1
     or char_length(p_provider_key) > 255
     or p_lease_expires_at is null
     or p_lease_expires_at <= now() then
    return jsonb_build_object('claimed', false, 'provider_key', null, 'state', null, 'lease_expires_at', null);
  end if;

  insert into public.tenant_quote_channel_sends (
    tenant_id,
    idempotency_key,
    channel,
    state,
    owner_token,
    provider_key,
    lease_expires_at
  ) values (
    p_tenant_id,
    p_idempotency_key,
    p_channel,
    'sending',
    p_owner_token,
    p_provider_key,
    p_lease_expires_at
  )
  on conflict (tenant_id, idempotency_key, channel) do nothing;

  select * into existing
  from public.tenant_quote_channel_sends
  where tenant_id = p_tenant_id
    and idempotency_key = p_idempotency_key
    and channel = p_channel
  for update;

  if not found then
    return jsonb_build_object('claimed', false, 'provider_key', null, 'state', null, 'lease_expires_at', null);
  end if;

  if existing.owner_token = p_owner_token
     and existing.state = 'sending'
     and existing.lease_expires_at > now() then
    return jsonb_build_object(
      'claimed', true,
      'provider_key', existing.provider_key,
      'state', existing.state,
      'lease_expires_at', existing.lease_expires_at
    );
  end if;

  if existing.state = 'ok' then
    return jsonb_build_object(
      'claimed', false,
      'provider_key', existing.provider_key,
      'state', existing.state,
      'lease_expires_at', existing.lease_expires_at
    );
  end if;

  if existing.state = 'failed'
     or (
       existing.state in ('sending', 'unknown')
       and existing.lease_expires_at <= now()
     ) then
    update public.tenant_quote_channel_sends
      set state = 'sending',
          owner_token = p_owner_token,
          lease_expires_at = p_lease_expires_at,
          updated_at = now()
      where tenant_id = p_tenant_id
        and idempotency_key = p_idempotency_key
        and channel = p_channel;

    return jsonb_build_object(
      'claimed', true,
      'provider_key', existing.provider_key,
      'state', 'sending',
      'lease_expires_at', p_lease_expires_at
    );
  end if;

  return jsonb_build_object(
    'claimed', false,
    'provider_key', existing.provider_key,
    'state', existing.state,
    'lease_expires_at', existing.lease_expires_at
  );
end;
$$;

revoke all on function public.claim_quote_channel_send(uuid, uuid, text, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_quote_channel_send(uuid, uuid, text, uuid, text, timestamptz)
  to service_role;
