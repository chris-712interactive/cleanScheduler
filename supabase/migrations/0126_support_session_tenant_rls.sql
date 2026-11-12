-- =============================================================================
-- 0126_support_session_tenant_rls.sql
-- =============================================================================
-- Platform staff (Auth app_metadata.app_role admin or super_admin) could read
-- every tenant's rows through RLS whenever is_platform_admin() was true, with
-- no masquerade_sessions row. Tenant-scoped policies now also require a live
-- support session for THAT row's tenant.
--
-- A live session matches the app TTL:
--   ended_at is null
--   started_at <= now() + 60 seconds   (clock skew)
--   started_at >= now() - 1 hour
-- The 60-second future bound is enforced here. PR #246's TypeScript helper
-- (liveMasqueradeSessionMatches) uses the same one-hour TTL but does not yet
-- reject a far-future started_at. Rebase onto that helper after it merges.
--
-- Left on is_platform_admin() alone (platform console data, not a tenant row):
--   user_profiles, tenants, marketing_inquiries, masquerade_sessions (select),
--   audit_log_entries, platform_support_tickets, platform_support_messages,
--   platform_seo_task_completions, public_rate_limit_buckets.
-- The admin console reads tenants with the service role, which bypasses RLS.
-- tenants_admin_or_member_read stays so a staff JWT can still list tenants.
--
-- customer_identities have no tenant_id. The platform-admin branch is true
-- only when a link or customer row ties the identity to a live session tenant.
-- customer_support_messages and tenant_role_permissions reach the tenant
-- through the parent thread or role.
-- Hiring policies call can_read_hiring_desk(). The membership and permission
-- branch is unchanged. The platform-admin branch now also needs a live session.
--
-- masquerade_sessions inserts and updates are service_role only. Staff cannot
-- create, extend, or reopen a session with their own JWT. Select stays
-- platform-admin. Server actions already write this table with the service role.
--
-- Apply this migration to dev, then later to prod. It does not run on deploy.

create or replace function public.has_live_support_session(p_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_tenant is not null
    and exists (
      select 1
      from public.masquerade_sessions s
      where s.admin_user_id = auth.uid()
        and s.target_tenant_id = p_tenant
        and s.ended_at is null
        and s.started_at <= now() + interval '60 seconds'
        and s.started_at >= now() - interval '1 hour'
    );
$$;

comment on function public.has_live_support_session(uuid) is
  'True when auth.uid() has an open masquerade_sessions row for this tenant, started_at is not more than 60 seconds in the future, and the row is inside the one-hour support TTL.';

revoke all on function public.has_live_support_session(uuid) from public;
revoke all on function public.has_live_support_session(uuid) from anon;
grant execute on function public.has_live_support_session(uuid) to authenticated;
grant execute on function public.has_live_support_session(uuid) to service_role;

create or replace function public.platform_staff_can_access_customer_identity(p_customer_identity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin()
    and (
      exists (
        select 1
        from public.customer_tenant_links ctl
        where ctl.customer_identity_id = p_customer_identity_id
          and public.has_live_support_session(ctl.tenant_id)
      )
      or exists (
        select 1
        from public.customers c
        where c.customer_identity_id = p_customer_identity_id
          and public.has_live_support_session(c.tenant_id)
      )
    );
$$;

comment on function public.platform_staff_can_access_customer_identity(uuid) is
  'True when the caller is platform staff and has a live support session for a tenant linked to this customer identity.';

revoke all on function public.platform_staff_can_access_customer_identity(uuid) from public;
revoke all on function public.platform_staff_can_access_customer_identity(uuid) from anon;
grant execute on function public.platform_staff_can_access_customer_identity(uuid) to authenticated;
grant execute on function public.platform_staff_can_access_customer_identity(uuid) to service_role;

create or replace function public.can_read_hiring_desk(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
      public.is_platform_admin()
      and public.has_live_support_session(target_tenant_id)
    )
    or exists (
      select 1
      from public.tenant_memberships tm
      where tm.tenant_id = target_tenant_id
        and tm.user_id = auth.uid()
        and tm.is_active = true
        and (
          tm.role in ('owner', 'admin')
          or exists (
            select 1
            from public.tenant_role_permissions trp
            where trp.role_id = tm.role_id
              and trp.permission_key in ('hiring.view', 'hiring.manage')
          )
        )
    );
$$;

comment on function public.can_read_hiring_desk(uuid) is
  'True when auth.uid() may read this tenant''s hiring desk: a live support session for platform staff, or an active owner/admin, or hiring.view / hiring.manage on the caller''s own membership.';

-- -----------------------------------------------------------------------------
-- Tenant-scoped policies: platform admin branch requires a live session
-- -----------------------------------------------------------------------------

drop policy if exists "bank_links_member_read" on public.bank_links;

create policy "bank_links_member_read"
  on public.bank_links
  for select
  to authenticated
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "bank_transactions_member_read" on public.bank_transactions;

create policy "bank_transactions_member_read"
  on public.bank_transactions
  for select
  to authenticated
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "compensation_rules_admin_write" on public.compensation_rules;

create policy "compensation_rules_admin_write"
  on public.compensation_rules
  for all
  to authenticated
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "compensation_rules_member_read" on public.compensation_rules;

create policy "compensation_rules_member_read"
  on public.compensation_rules
  for select
  to authenticated
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "customer_identities_admin_or_owner_read" on public.customer_identities;

create policy "customer_identities_admin_or_owner_read"
  on public.customer_identities
  for select
  using (
    public.platform_staff_can_access_customer_identity(id)
    or auth_user_id = auth.uid()
    or public.tenant_member_can_read_customer_identity(id)
  );

drop policy if exists "customer_identities_admin_write" on public.customer_identities;

create policy "customer_identities_admin_write"
  on public.customer_identities
  for all
  using (public.platform_staff_can_access_customer_identity(id))
  with check (public.platform_staff_can_access_customer_identity(id));

drop policy if exists "customer_subscriptions_member_all" on public.customer_subscriptions;

create policy "customer_subscriptions_member_all"
  on public.customer_subscriptions
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "customer_support_messages_member_all" on public.customer_support_messages;

create policy "customer_support_messages_member_all"
  on public.customer_support_messages
  for all
  using (
    (
  public.is_platform_admin()
  and exists (
    select 1
    from public.customer_support_threads support_thread
    where support_thread.id = thread_id
      and public.has_live_support_session(support_thread.tenant_id)
  )
)
    or exists (
      select 1
      from public.customer_support_threads t
      where t.id = customer_support_messages.thread_id
        and public.has_tenant_membership(t.tenant_id)
    )
  )
  with check (
    (
  public.is_platform_admin()
  and exists (
    select 1
    from public.customer_support_threads support_thread
    where support_thread.id = thread_id
      and public.has_live_support_session(support_thread.tenant_id)
  )
)
    or exists (
      select 1
      from public.customer_support_threads t
      where t.id = customer_support_messages.thread_id
        and public.has_tenant_membership(t.tenant_id)
    )
  );

drop policy if exists "customer_support_threads_member_all" on public.customer_support_threads;

create policy "customer_support_threads_member_all"
  on public.customer_support_threads
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "customer_tenant_links_admin_or_tenant_member_read" on public.customer_tenant_links;

create policy "customer_tenant_links_admin_or_tenant_member_read"
  on public.customer_tenant_links
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "customer_tenant_links_admin_or_tenant_member_write" on public.customer_tenant_links;

create policy "customer_tenant_links_admin_or_tenant_member_write"
  on public.customer_tenant_links
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "customers_admin_or_tenant_member_read" on public.customers;

create policy "customers_admin_or_tenant_member_read"
  on public.customers
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "customers_admin_or_tenant_member_write" on public.customers;

create policy "customers_admin_or_tenant_member_write"
  on public.customers
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "payment_match_suggestions_member_read" on public.payment_match_suggestions;

create policy "payment_match_suggestions_member_read"
  on public.payment_match_suggestions
  for select
  to authenticated
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "recurring_appointment_rules_member_all" on public.recurring_appointment_rules;

create policy "recurring_appointment_rules_member_all"
  on public.recurring_appointment_rules
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "report_runs_member_read" on public.report_runs;

create policy "report_runs_member_read"
  on public.report_runs
  for select
  to authenticated
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "service_plans_member_all" on public.service_plans;

create policy "service_plans_member_all"
  on public.service_plans
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "subscription_coverage_forfeits_member_all" on public.subscription_coverage_forfeits;

create policy "subscription_coverage_forfeits_member_all"
  on public.subscription_coverage_forfeits
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "subscription_coverage_grants_member_all" on public.subscription_coverage_grants;

create policy "subscription_coverage_grants_member_all"
  on public.subscription_coverage_grants
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "subscription_coverage_makeups_member_all" on public.subscription_coverage_makeups;

create policy "subscription_coverage_makeups_member_all"
  on public.subscription_coverage_makeups
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_billing_accounts_admin_write" on public.tenant_billing_accounts;

create policy "tenant_billing_accounts_admin_write"
  on public.tenant_billing_accounts
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)));

drop policy if exists "tenant_billing_accounts_member_read" on public.tenant_billing_accounts;

create policy "tenant_billing_accounts_member_read"
  on public.tenant_billing_accounts
  for select
  using (
    (public.is_platform_admin() and public.has_live_support_session(tenant_id))
    or public.has_tenant_membership(tenant_id)
  );

drop policy if exists "tenant_booking_slot_locks_member_all" on public.tenant_booking_slot_locks;

create policy "tenant_booking_slot_locks_member_all"
  on public.tenant_booking_slot_locks
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_customer_profiles_member_read" on public.tenant_customer_profiles;

create policy "tenant_customer_profiles_member_read"
  on public.tenant_customer_profiles
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_customer_profiles_member_write" on public.tenant_customer_profiles;

create policy "tenant_customer_profiles_member_write"
  on public.tenant_customer_profiles
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check (
    (public.is_platform_admin() and public.has_live_support_session(tenant_id))
    or (
      public.has_tenant_membership(tenant_id)
      and exists (
        select 1
        from public.customers c
        where c.id = tenant_customer_profiles.customer_id
          and c.tenant_id = tenant_customer_profiles.tenant_id
      )
    )
  );

drop policy if exists "tenant_customer_properties_member_read" on public.tenant_customer_properties;

create policy "tenant_customer_properties_member_read"
  on public.tenant_customer_properties
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_customer_properties_member_write" on public.tenant_customer_properties;

create policy "tenant_customer_properties_member_write"
  on public.tenant_customer_properties
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check (
    (public.is_platform_admin() and public.has_live_support_session(tenant_id))
    or (
      public.has_tenant_membership(tenant_id)
      and exists (
        select 1
        from public.customers c
        where c.id = tenant_customer_properties.customer_id
          and c.tenant_id = tenant_customer_properties.tenant_id
      )
    )
  );

drop policy if exists "tenant_customer_stripe_customers_member_all" on public.tenant_customer_stripe_customers;

create policy "tenant_customer_stripe_customers_member_all"
  on public.tenant_customer_stripe_customers
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_email_campaign_recipients_member_read" on public.tenant_email_campaign_recipients;

create policy "tenant_email_campaign_recipients_member_read"
  on public.tenant_email_campaign_recipients
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_email_campaigns_member_read" on public.tenant_email_campaigns;

create policy "tenant_email_campaigns_member_read"
  on public.tenant_email_campaigns
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_email_campaigns_member_write" on public.tenant_email_campaigns;

create policy "tenant_email_campaigns_member_write"
  on public.tenant_email_campaigns
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_email_suppressions_member_read" on public.tenant_email_suppressions;

create policy "tenant_email_suppressions_member_read"
  on public.tenant_email_suppressions
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_email_suppressions_member_write" on public.tenant_email_suppressions;

create policy "tenant_email_suppressions_member_write"
  on public.tenant_email_suppressions
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_instant_booking_offers_member_all" on public.tenant_instant_booking_offers;

create policy "tenant_instant_booking_offers_member_all"
  on public.tenant_instant_booking_offers
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_instant_booking_zone_coverage_member_all" on public.tenant_instant_booking_zone_coverage;

create policy "tenant_instant_booking_zone_coverage_member_all"
  on public.tenant_instant_booking_zone_coverage
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_instant_bookings_member_all" on public.tenant_instant_bookings;

create policy "tenant_instant_bookings_member_all"
  on public.tenant_instant_bookings
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_instant_slot_tokens_member_all" on public.tenant_instant_slot_tokens;

create policy "tenant_instant_slot_tokens_member_all"
  on public.tenant_instant_slot_tokens
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_invoice_payments_member_read" on public.tenant_invoice_payments;

create policy "tenant_invoice_payments_member_read"
  on public.tenant_invoice_payments
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_invoice_payments_member_write" on public.tenant_invoice_payments;

create policy "tenant_invoice_payments_member_write"
  on public.tenant_invoice_payments
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_invoices_member_read" on public.tenant_invoices;

create policy "tenant_invoices_member_read"
  on public.tenant_invoices
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_invoices_member_write" on public.tenant_invoices;

create policy "tenant_invoices_member_write"
  on public.tenant_invoices
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_memberships_admin_write" on public.tenant_memberships;

create policy "tenant_memberships_admin_write"
  on public.tenant_memberships
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)));

drop policy if exists "tenant_memberships_self_or_admin_read" on public.tenant_memberships;

create policy "tenant_memberships_self_or_admin_read"
  on public.tenant_memberships
  for select
  using (
    (public.is_platform_admin() and public.has_live_support_session(tenant_id))
    or user_id = auth.uid()
    or public.has_tenant_membership(tenant_id)
  );

drop policy if exists "tenant_onboarding_profiles_admin_write" on public.tenant_onboarding_profiles;

create policy "tenant_onboarding_profiles_admin_write"
  on public.tenant_onboarding_profiles
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)));

drop policy if exists "tenant_onboarding_profiles_member_read" on public.tenant_onboarding_profiles;

create policy "tenant_onboarding_profiles_member_read"
  on public.tenant_onboarding_profiles
  for select
  using (
    (public.is_platform_admin() and public.has_live_support_session(tenant_id))
    or public.has_tenant_membership(tenant_id)
  );

drop policy if exists "tenant_operational_settings_member_read" on public.tenant_operational_settings;

create policy "tenant_operational_settings_member_read"
  on public.tenant_operational_settings
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_operational_settings_member_write" on public.tenant_operational_settings;

create policy "tenant_operational_settings_member_write"
  on public.tenant_operational_settings
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_payment_events_member_read" on public.tenant_payment_events;

create policy "tenant_payment_events_member_read"
  on public.tenant_payment_events
  for select
  to authenticated
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_quote_e_signatures_member_read" on public.tenant_quote_acceptance_e_signatures;

create policy "tenant_quote_e_signatures_member_read"
  on public.tenant_quote_acceptance_e_signatures
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_quote_e_signatures_member_write" on public.tenant_quote_acceptance_e_signatures;

create policy "tenant_quote_e_signatures_member_write"
  on public.tenant_quote_acceptance_e_signatures
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_quote_acceptance_snapshots_member_read" on public.tenant_quote_acceptance_snapshots;

create policy "tenant_quote_acceptance_snapshots_member_read"
  on public.tenant_quote_acceptance_snapshots
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_quote_acceptance_snapshots_member_write" on public.tenant_quote_acceptance_snapshots;

create policy "tenant_quote_acceptance_snapshots_member_write"
  on public.tenant_quote_acceptance_snapshots
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_quote_line_items_member_read" on public.tenant_quote_line_items;

create policy "tenant_quote_line_items_member_read"
  on public.tenant_quote_line_items
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_quote_line_items_member_write" on public.tenant_quote_line_items;

create policy "tenant_quote_line_items_member_write"
  on public.tenant_quote_line_items
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_quote_pipeline_stages_member_all" on public.tenant_quote_pipeline_stages;

create policy "tenant_quote_pipeline_stages_member_all"
  on public.tenant_quote_pipeline_stages
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_quotes_admin_or_tenant_member_read" on public.tenant_quotes;

create policy "tenant_quotes_admin_or_tenant_member_read"
  on public.tenant_quotes
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_quotes_admin_or_tenant_member_write" on public.tenant_quotes;

create policy "tenant_quotes_admin_or_tenant_member_write"
  on public.tenant_quotes
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check (
    (public.is_platform_admin() and public.has_live_support_session(tenant_id))
    or (
      public.has_tenant_membership(tenant_id)
      and (
        customer_id is null
        or exists (
          select 1
          from public.customers cu
          where cu.id = tenant_quotes.customer_id
            and cu.tenant_id = tenant_quotes.tenant_id
        )
      )
    )
  );

drop policy if exists "tenant_role_permissions_admin_write" on public.tenant_role_permissions;

create policy "tenant_role_permissions_admin_write"
  on public.tenant_role_permissions
  for all
  using (
    (
  public.is_platform_admin()
  and exists (
    select 1
    from public.tenant_roles staff_role
    where staff_role.id = role_id
      and public.has_live_support_session(staff_role.tenant_id)
  )
)
    or exists (
      select 1
      from public.tenant_roles tr
      where tr.id = role_id
        and public.has_tenant_membership(tr.tenant_id)
    )
  )
  with check (
    (
  public.is_platform_admin()
  and exists (
    select 1
    from public.tenant_roles staff_role
    where staff_role.id = role_id
      and public.has_live_support_session(staff_role.tenant_id)
  )
)
    or exists (
      select 1
      from public.tenant_roles tr
      where tr.id = role_id
        and public.has_tenant_membership(tr.tenant_id)
    )
  );

drop policy if exists "tenant_role_permissions_member_read" on public.tenant_role_permissions;

create policy "tenant_role_permissions_member_read"
  on public.tenant_role_permissions
  for select
  using (
    (
  public.is_platform_admin()
  and exists (
    select 1
    from public.tenant_roles staff_role
    where staff_role.id = role_id
      and public.has_live_support_session(staff_role.tenant_id)
  )
)
    or exists (
      select 1
      from public.tenant_roles tr
      where tr.id = role_id
        and public.has_tenant_membership(tr.tenant_id)
    )
  );

drop policy if exists "tenant_roles_admin_write" on public.tenant_roles;

create policy "tenant_roles_admin_write"
  on public.tenant_roles
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_roles_member_read" on public.tenant_roles;

create policy "tenant_roles_member_read"
  on public.tenant_roles
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_scheduled_visits_member_read" on public.tenant_scheduled_visits;

create policy "tenant_scheduled_visits_member_read"
  on public.tenant_scheduled_visits
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_scheduled_visits_member_write" on public.tenant_scheduled_visits;

create policy "tenant_scheduled_visits_member_write"
  on public.tenant_scheduled_visits
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check (
    (public.is_platform_admin() and public.has_live_support_session(tenant_id))
    or (
      public.has_tenant_membership(tenant_id)
      and exists (
        select 1
        from public.customers c
        where c.id = tenant_scheduled_visits.customer_id
          and c.tenant_id = tenant_scheduled_visits.tenant_id
      )
    )
  );

drop policy if exists "tenant_service_templates_member_read" on public.tenant_service_templates;

create policy "tenant_service_templates_member_read"
  on public.tenant_service_templates
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_service_templates_member_write" on public.tenant_service_templates;

create policy "tenant_service_templates_member_write"
  on public.tenant_service_templates
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_service_zones_member_all" on public.tenant_service_zones;

create policy "tenant_service_zones_member_all"
  on public.tenant_service_zones
  for all
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id))
  with check ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_stripe_connect_accounts_member_read" on public.tenant_stripe_connect_accounts;

create policy "tenant_stripe_connect_accounts_member_read"
  on public.tenant_stripe_connect_accounts
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_stripe_disputes_member_read" on public.tenant_stripe_disputes;

create policy "tenant_stripe_disputes_member_read"
  on public.tenant_stripe_disputes
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_stripe_payouts_member_read" on public.tenant_stripe_payouts;

create policy "tenant_stripe_payouts_member_read"
  on public.tenant_stripe_payouts
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_stripe_refunds_member_read" on public.tenant_stripe_refunds;

create policy "tenant_stripe_refunds_member_read"
  on public.tenant_stripe_refunds
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "tenant_usage_snapshots_member_read" on public.tenant_usage_snapshots;

create policy "tenant_usage_snapshots_member_read"
  on public.tenant_usage_snapshots
  for select
  using ((public.is_platform_admin() and public.has_live_support_session(tenant_id)) or public.has_tenant_membership(tenant_id));

drop policy if exists "visit_reschedule_requests_member_all" on public.visit_reschedule_requests;

create policy "visit_reschedule_requests_member_all"
  on public.visit_reschedule_requests
  for all
  using (
    (public.is_platform_admin() and public.has_live_support_session(tenant_id))
    or public.has_tenant_membership(tenant_id)
  )
  with check (
    (public.is_platform_admin() and public.has_live_support_session(tenant_id))
    or public.has_tenant_membership(tenant_id)
  );


-- -----------------------------------------------------------------------------
-- masquerade_sessions: staff JWT cannot insert, update, or delete
-- -----------------------------------------------------------------------------

drop policy if exists "masquerade_sessions_platform_write" on public.masquerade_sessions;

revoke insert, update, delete on table public.masquerade_sessions from public;
revoke insert, update, delete on table public.masquerade_sessions from anon;
revoke insert, update, delete on table public.masquerade_sessions from authenticated;
grant select, insert, update, delete on table public.masquerade_sessions to service_role;

-- One open support session per staff user. Close older open rows first so
-- databases that already stacked sessions can take the unique index.
with ranked as (
  select
    id,
    row_number() over (
      partition by admin_user_id
      order by started_at desc, id desc
    ) as n
  from public.masquerade_sessions
  where ended_at is null
)
update public.masquerade_sessions as session
set ended_at = now()
from ranked
where session.id = ranked.id
  and ranked.n > 1;

create unique index masquerade_sessions_one_open_per_staff
  on public.masquerade_sessions (admin_user_id)
  where ended_at is null;

-- -----------------------------------------------------------------------------
-- One-time support handoff tokens. Only a hash is stored. Service role only.
-- -----------------------------------------------------------------------------

create table public.masquerade_handoff_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  target_tenant_id uuid not null references public.tenants(id) on delete cascade,
  masquerade_session_id uuid not null references public.masquerade_sessions(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint masquerade_handoff_tokens_hash_sha256 check (token_hash ~ '^[0-9a-f]{64}$')
);

comment on table public.masquerade_handoff_tokens is
  'Single-use support handoff. Store only the SHA-256 hex of the URL token. The app sets expires_at at most 60 seconds ahead.';

create index masquerade_handoff_tokens_session_idx
  on public.masquerade_handoff_tokens (masquerade_session_id);

alter table public.masquerade_handoff_tokens enable row level security;

revoke all on table public.masquerade_handoff_tokens from public;
revoke all on table public.masquerade_handoff_tokens from anon;
revoke all on table public.masquerade_handoff_tokens from authenticated;
grant select, insert, update, delete on table public.masquerade_handoff_tokens to service_role;

-- -----------------------------------------------------------------------------
-- Fail the migration if a tenant policy still lets platform admin through
-- with no live-session check, or if staff can write sessions.
-- -----------------------------------------------------------------------------

do $$
declare
  leftover text;
  helper_src text;
begin
  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'has_live_support_session'
      and pg_get_function_identity_arguments(p.oid) = 'p_tenant uuid'
      and p.prosecdef
      and p.provolatile = 's'
      and exists (
        select 1
        from unnest(coalesce(p.proconfig, array[]::text[])) cfg
        where cfg = 'search_path=public'
      )
  ) then
    raise exception 'has_live_support_session(uuid) must be stable security definer with search_path=public';
  end if;

  if has_function_privilege('anon', 'public.has_live_support_session(uuid)', 'execute') then
    raise exception 'anon can execute has_live_support_session';
  end if;
  if not has_function_privilege('authenticated', 'public.has_live_support_session(uuid)', 'execute') then
    raise exception 'authenticated cannot execute has_live_support_session';
  end if;
  if not has_function_privilege('service_role', 'public.has_live_support_session(uuid)', 'execute') then
    raise exception 'service_role cannot execute has_live_support_session';
  end if;

  select pg_get_functiondef('public.can_read_hiring_desk(uuid)'::regprocedure) into helper_src;
  if helper_src is null or position('has_live_support_session' in helper_src) = 0 then
    raise exception 'can_read_hiring_desk must require a live support session for platform staff';
  end if;

  select string_agg(format('%s.%s', tablename, policyname), ', ' order by tablename, policyname)
    into leftover
  from pg_policies
  where schemaname = 'public'
    and tablename not in (
      'user_profiles',
      'tenants',
      'marketing_inquiries',
      'masquerade_sessions',
      'audit_log_entries',
      'platform_support_tickets',
      'platform_support_messages',
      'platform_seo_task_completions',
      'public_rate_limit_buckets'
    )
    and (
      (
        coalesce(qual, '') ~ 'is_platform_admin\s*\('
        and coalesce(qual, '') !~ 'has_live_support_session'
        and coalesce(qual, '') !~ 'platform_staff_can_access_customer_identity'
      )
      or (
        coalesce(with_check, '') ~ 'is_platform_admin\s*\('
        and coalesce(with_check, '') !~ 'has_live_support_session'
        and coalesce(with_check, '') !~ 'platform_staff_can_access_customer_identity'
      )
    );

  if leftover is not null then
    raise exception 'tenant policy still grants is_platform_admin without a live session: %', leftover;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'masquerade_sessions'
      and policyname = 'masquerade_sessions_platform_write'
  ) then
    raise exception 'masquerade_sessions_platform_write is still present';
  end if;

  if has_table_privilege('authenticated', 'public.masquerade_sessions', 'INSERT')
     or has_table_privilege('authenticated', 'public.masquerade_sessions', 'UPDATE') then
    raise exception 'authenticated can still insert or update masquerade_sessions';
  end if;

  if not has_table_privilege('service_role', 'public.masquerade_sessions', 'INSERT')
     or not has_table_privilege('service_role', 'public.masquerade_sessions', 'UPDATE') then
    raise exception 'service_role cannot write masquerade_sessions';
  end if;

  if has_table_privilege('authenticated', 'public.masquerade_handoff_tokens', 'SELECT')
     or has_table_privilege('authenticated', 'public.masquerade_handoff_tokens', 'INSERT') then
    raise exception 'authenticated can read or insert masquerade handoff tokens';
  end if;
end $$;
