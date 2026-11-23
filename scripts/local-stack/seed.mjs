/**
 * Deterministic QA tenants for the disposable local stack.
 * Refuses any URL that is not the local Supabase API or a loopback Postgres.
 * Auth claims are written to app_metadata only.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLocalStackEnv } from './local-only-url.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const accounts = JSON.parse(readFileSync(path.join(__dirname, 'qa-accounts.json'), 'utf8'));

const POINT = { latitude: 35.5951, longitude: -82.5515 };

export function utcInstantForZonedCivilTime(timeZone, year, month, day, hour, minute) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(
    format.formatToParts(new Date(utcGuess)).map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return new Date(utcGuess - (asUtc - utcGuess));
}

export function todayVisitWindow(timeZone, startHour, endHour, now = new Date()) {
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = Object.fromEntries(
    format.formatToParts(now).map((part) => [part.type, part.value]),
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  return {
    startsAt: utcInstantForZonedCivilTime(timeZone, year, month, day, startHour, 0).toISOString(),
    endsAt: utcInstantForZonedCivilTime(timeZone, year, month, day, endHour, 0).toISOString(),
  };
}

function fail(error, label) {
  const message = error?.message ?? String(error);
  throw new Error(`${label}: ${message}`);
}

async function must(promise, label) {
  const result = await promise;
  if (result.error) fail(result.error, label);
  return result.data;
}

function geocodeColumns(property) {
  const now = new Date().toISOString();
  if (property.geocode === 'ok') {
    return {
      latitude: property.latitude ?? POINT.latitude,
      longitude: property.longitude ?? POINT.longitude,
      geocode_status: 'ok',
      geocode_source: 'census',
      geocode_accuracy: 'address:L',
      geocoded_at: now,
      geocode_reason: null,
    };
  }
  if (property.geocode === 'no_match') {
    return {
      latitude: null,
      longitude: null,
      geocode_status: 'failed',
      geocode_source: null,
      geocode_accuracy: null,
      geocoded_at: now,
      geocode_reason: 'no_match',
    };
  }
  return {
    latitude: null,
    longitude: null,
    geocode_status: 'pending',
    geocode_source: null,
    geocode_accuracy: null,
    geocoded_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    geocode_reason: 'lookup_failed',
  };
}

async function ensureUser(admin, spec, tenantId) {
  const appMetadata = { app_role: spec.appRole };
  if (spec.role) {
    appMetadata.tenant_role = spec.role;
    appMetadata.current_tenant_id = tenantId;
  }
  const created = await admin.auth.admin.createUser({
    ...(spec.userId ? { id: spec.userId } : {}),
    email: spec.email,
    password: accounts.password,
    email_confirm: true,
    app_metadata: appMetadata,
    user_metadata: {},
  });
  let userId = created.data.user?.id ?? null;
  if (created.error || !userId) {
    const message = created.error?.message ?? 'no user id';
    if (!/already|exists|registered/i.test(message)) {
      throw new Error(`Could not create ${spec.email}: ${message}`);
    }
    const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listed.error) fail(listed.error, 'list users');
    const found = listed.data.users.find((user) => user.email?.toLowerCase() === spec.email);
    if (!found) throw new Error(`Could not find existing local user ${spec.email}`);
    const updated = await admin.auth.admin.updateUserById(found.id, {
      password: accounts.password,
      email_confirm: true,
      app_metadata: appMetadata,
      user_metadata: {},
    });
    if (updated.error) fail(updated.error, `update ${spec.email}`);
    userId = found.id;
  }

  const [firstName, ...rest] = spec.displayName.split(' ');
  await must(
    admin.from('user_profiles').upsert(
      {
        user_id: userId,
        app_role: spec.appRole,
        display_name: spec.displayName,
        first_name: firstName,
        last_name: rest.join(' ') || null,
      },
      { onConflict: 'user_id' },
    ),
    `profile ${spec.email}`,
  );

  if (spec.role) {
    await must(
      admin.from('tenant_memberships').upsert(
        {
          tenant_id: tenantId,
          user_id: userId,
          role: spec.role,
          is_active: true,
        },
        { onConflict: 'tenant_id,user_id' },
      ),
      `membership ${spec.email}`,
    );
  }
  return userId;
}

async function seedTenant(admin, workspace, members) {
  const existing = await must(
    admin.from('tenants').select('id').eq('slug', workspace.slug).maybeSingle(),
    `lookup ${workspace.slug}`,
  );
  if (existing && existing.id !== workspace.tenantId) {
    throw new Error(
      `Local tenant ${workspace.slug} already has a different id. Reset the local database and seed again.`,
    );
  }

  await must(
    admin.from('tenants').upsert(
      {
        id: workspace.tenantId,
        slug: workspace.slug,
        name: workspace.name,
        timezone: accounts.timeZone,
        is_active: true,
        latitude: workspace.latitude ?? null,
        longitude: workspace.longitude ?? null,
      },
      { onConflict: 'id' },
    ),
    `tenant ${workspace.slug}`,
  );

  const userIds = {};
  for (const member of members) {
    userIds[member.email] = await ensureUser(admin, member, workspace.tenantId);
  }

  const billing = {
    tenant_id: workspace.tenantId,
    status: workspace.billingStatus ?? 'active',
    platform_plan: Object.prototype.hasOwnProperty.call(workspace, 'platformPlan')
      ? workspace.platformPlan
      : 'business',
    billing_interval: Object.prototype.hasOwnProperty.call(workspace, 'billingInterval')
      ? workspace.billingInterval
      : 'month',
  };
  if (Object.prototype.hasOwnProperty.call(workspace, 'stripeSubscriptionStatus')) {
    billing.stripe_subscription_status = workspace.stripeSubscriptionStatus;
  }
  if (workspace.stripeCustomerId) billing.stripe_customer_id = workspace.stripeCustomerId;
  if (workspace.stripeSubscriptionId) {
    billing.stripe_subscription_id = workspace.stripeSubscriptionId;
  }
  if (workspace.activatedAt) billing.activated_at = workspace.activatedAt;

  await must(
    admin.from('tenant_billing_accounts').upsert(billing, { onConflict: 'tenant_id' }),
    `billing ${workspace.slug}`,
  );

  if (workspace.stripeSubscriptionStatus) {
    const stored = await must(
      admin
        .from('tenant_billing_accounts')
        .select('status, platform_plan, stripe_subscription_status, stripe_customer_id')
        .eq('tenant_id', workspace.tenantId)
        .maybeSingle(),
      `read billing ${workspace.slug}`,
    );
    if (
      stored?.stripe_subscription_status !== workspace.stripeSubscriptionStatus ||
      stored?.status !== billing.status ||
      stored?.platform_plan !== billing.platform_plan ||
      (workspace.stripeCustomerId && stored?.stripe_customer_id !== workspace.stripeCustomerId)
    ) {
      throw new Error(`Billing row for ${workspace.slug} was not stored as seeded.`);
    }
  }

  const settings = await must(
    admin
      .from('tenant_operational_settings')
      .update({ service_segment: workspace.segment })
      .eq('tenant_id', workspace.tenantId)
      .select('tenant_id'),
    `segment ${workspace.slug}`,
  );
  if (!settings?.length) {
    await must(
      admin.from('tenant_operational_settings').insert({
        tenant_id: workspace.tenantId,
        service_segment: workspace.segment,
      }),
      `segment insert ${workspace.slug}`,
    );
  }
  return userIds;
}

async function seedCustomers(admin, workspace, portalUserId) {
  for (const customer of Object.values(workspace.customers)) {
    await must(
      admin.from('customer_identities').upsert(
        {
          id: customer.identityId,
          auth_user_id: customer.portal ? portalUserId : null,
          email: customer.email,
          first_name: customer.firstName,
          last_name: customer.lastName,
          full_name: `${customer.firstName} ${customer.lastName}`,
        },
        { onConflict: 'id' },
      ),
      `identity ${customer.email}`,
    );
    await must(
      admin.from('customers').upsert(
        {
          id: customer.id,
          tenant_id: workspace.tenantId,
          customer_identity_id: customer.identityId,
          status: 'active',
        },
        { onConflict: 'id' },
      ),
      `customer ${customer.email}`,
    );
    await must(
      admin.from('customer_tenant_links').upsert(
        {
          customer_identity_id: customer.identityId,
          tenant_id: workspace.tenantId,
          customer_id: customer.id,
          is_primary: true,
        },
        { onConflict: 'customer_identity_id,tenant_id' },
      ),
      `link ${customer.email}`,
    );
  }

  for (const property of Object.values(workspace.properties)) {
    const customer = workspace.customers[property.customer];
    await must(
      admin.from('tenant_customer_properties').upsert(
        {
          id: property.id,
          tenant_id: workspace.tenantId,
          customer_id: customer.id,
          label: property.label,
          property_kind: property.kind,
          address_line1: property.line1,
          city: property.city,
          state: property.state,
          postal_code: property.postal,
          is_primary: property.primary,
          scheduling_override: property.schedulingOverride ?? null,
          ...geocodeColumns(property),
        },
        { onConflict: 'id' },
      ),
      `property ${property.label}`,
    );
  }
}

const DISPATCH_WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

async function seedDispatchHours(admin, workspace, userIds, members) {
  for (const member of members) {
    const userId = userIds[member.email];
    if (!userId) throw new Error(`No seeded member for dispatch hours ${member.email}.`);
    await must(
      admin.from('tenant_member_schedule_profiles').upsert(
        {
          tenant_id: workspace.tenantId,
          user_id: userId,
          use_tenant_default: false,
        },
        { onConflict: 'tenant_id,user_id' },
      ),
      `dispatch hours ${member.email}`,
    );
    for (const weekday of DISPATCH_WEEKDAYS) {
      await must(
        admin.from('tenant_member_availability_days').upsert(
          {
            tenant_id: workspace.tenantId,
            user_id: userId,
            weekday,
            starts_at: '06:00',
            ends_at: '21:00',
          },
          { onConflict: 'tenant_id,user_id,weekday' },
        ),
        `dispatch day ${member.email} ${weekday}`,
      );
    }
  }
}

async function seedVisits(admin, workspace, userIds) {
  const specs = workspace.visits ?? [
    {
      id: workspace.visitId,
      property: Object.keys(workspace.properties)[0],
      customer: Object.keys(workspace.customers)[0],
      assignee: null,
      hour: 13,
    },
  ];
  const ids = [];
  for (const spec of specs) {
    const window = todayVisitWindow(accounts.timeZone, spec.hour, spec.hour + 1);
    await must(
      admin.from('tenant_scheduled_visits').upsert(
        {
          id: spec.id,
          tenant_id: workspace.tenantId,
          customer_id: workspace.customers[spec.customer].id,
          property_id: workspace.properties[spec.property].id,
          title: spec.title ?? 'QA local stack visit',
          starts_at: window.startsAt,
          ends_at: window.endsAt,
          status: 'scheduled',
          visit_purpose: 'service',
        },
        { onConflict: 'id' },
      ),
      `visit ${spec.id}`,
    );
    if (spec.assignee) {
      const member = workspace[spec.assignee];
      const userId = userIds[member?.email];
      if (!userId) {
        throw new Error(`No seeded member for assignee ${spec.assignee} on ${workspace.slug}.`);
      }
      await must(
        admin
          .from('tenant_scheduled_visit_assignees')
          .upsert({ visit_id: spec.id, user_id: userId }, { onConflict: 'visit_id,user_id' }),
        `assignee ${spec.id}`,
      );
    }
    ids.push(spec.id);
  }
  return ids;
}

function todayKey(timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function seedRoutingExtras(admin, workspace, userIds) {
  const extras = workspace.routing;
  if (!extras) return;
  const day = todayKey(accounts.timeZone);
  for (const home of extras.homes ?? []) {
    const userId = userIds[workspace[home.member]?.email];
    if (!userId) throw new Error(`No member for home ${home.member} on ${workspace.slug}.`);
    await must(
      admin.from('tenant_member_scheduling_profiles').upsert(
        {
          tenant_id: workspace.tenantId,
          user_id: userId,
          home_address_line1: home.line1,
          home_city: home.city,
          home_state: home.state,
          home_postal_code: home.postal,
          home_latitude: home.latitude,
          home_longitude: home.longitude,
        },
        { onConflict: 'tenant_id,user_id' },
      ),
      `home ${home.line1}`,
    );
  }
  for (const row of extras.applied ?? []) {
    const userId = userIds[workspace[row.member]?.email];
    if (!userId) throw new Error(`No member for applied route ${row.member} on ${workspace.slug}.`);
    await must(
      admin.from('tenant_applied_route_days').upsert(
        {
          tenant_id: workspace.tenantId,
          service_date: day,
          user_id: userId,
          estimate_kind: row.kind,
          miles: row.miles,
          drive_seconds: row.kind === 'drive' ? row.driveSeconds : null,
          stop_count: row.stops,
          day_fingerprint: row.fingerprint,
        },
        { onConflict: 'tenant_id,service_date,user_id' },
      ),
      `applied route ${workspace.slug}`,
    );
  }
}

export async function seedLocalStack(env = process.env) {
  assertLocalStackEnv(env);
  const url = env.NEXT_PUBLIC_SUPABASE_URL.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is empty.');
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const residentialUsers = await seedTenant(admin, accounts.residential, [
    accounts.residential.owner,
    accounts.residential.admin,
    accounts.residential.cleaner,
    accounts.residential.portalUser,
  ]);
  await seedCustomers(
    admin,
    accounts.residential,
    residentialUsers[accounts.residential.portalUser.email],
  );
  const residentialVisitIds = await seedVisits(admin, accounts.residential, residentialUsers);
  await seedDispatchHours(admin, accounts.residential, residentialUsers, [
    accounts.residential.owner,
    accounts.residential.admin,
    accounts.residential.cleaner,
  ]);

  const commercialUsers = await seedTenant(admin, accounts.commercial, [accounts.commercial.owner]);
  await seedCustomers(admin, accounts.commercial, null);
  const commercialVisitIds = await seedVisits(admin, accounts.commercial, commercialUsers);
  await seedRoutingExtras(admin, accounts.commercial, commercialUsers);

  const proUsers = await seedTenant(admin, accounts.pro, [
    accounts.pro.owner,
    accounts.pro.cleaner,
  ]);
  await seedCustomers(admin, accounts.pro, null);
  const proVisitIds = await seedVisits(admin, accounts.pro, proUsers);
  await seedDispatchHours(admin, accounts.pro, proUsers, [
    accounts.pro.owner,
    accounts.pro.cleaner,
  ]);
  await seedRoutingExtras(admin, accounts.pro, proUsers);

  const trialUsers = await seedTenant(admin, accounts.trial, [
    accounts.trial.owner,
    accounts.trial.cleaner,
  ]);
  await seedCustomers(admin, accounts.trial, null);
  const trialVisitIds = await seedVisits(admin, accounts.trial, trialUsers);
  await seedDispatchHours(admin, accounts.trial, trialUsers, [
    accounts.trial.owner,
    accounts.trial.cleaner,
  ]);

  const pastDueUsers = await seedTenant(admin, accounts.pastDue, [
    accounts.pastDue.owner,
    accounts.pastDue.cleaner,
  ]);
  await seedCustomers(admin, accounts.pastDue, null);
  const pastDueVisitIds = await seedVisits(admin, accounts.pastDue, pastDueUsers);
  await seedDispatchHours(admin, accounts.pastDue, pastDueUsers, [
    accounts.pastDue.owner,
    accounts.pastDue.cleaner,
  ]);
  await seedRoutingExtras(admin, accounts.pastDue, pastDueUsers);

  const pausedUsers = await seedTenant(admin, accounts.paused, [
    accounts.paused.owner,
    accounts.paused.cleaner,
  ]);
  await seedCustomers(admin, accounts.paused, null);
  const pausedVisitIds = await seedVisits(admin, accounts.paused, pausedUsers);
  await seedDispatchHours(admin, accounts.paused, pausedUsers, [
    accounts.paused.owner,
    accounts.paused.cleaner,
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const expectedIds = [
    ...residentialVisitIds,
    ...commercialVisitIds,
    ...proVisitIds,
    ...trialVisitIds,
    ...pastDueVisitIds,
    ...pausedVisitIds,
  ];
  const visits = await must(
    admin.from('tenant_scheduled_visits').select('id, starts_at, tenant_id').in('id', expectedIds),
    'read visits',
  );
  if (visits.length !== expectedIds.length) {
    throw new Error(`Expected ${expectedIds.length} QA visits, found ${visits.length}.`);
  }
  console.log(
    `local-stack seed ok tenants=6 visits=${visits.length} day=${today} emails=@example.test`,
  );
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (entry.endsWith(`${path.sep}seed.mjs`)) {
  seedLocalStack().catch((error) => {
    console.error(error instanceof Error ? error.message : 'Seed failed.');
    process.exit(1);
  });
}
