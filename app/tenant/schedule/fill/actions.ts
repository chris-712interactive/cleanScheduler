'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { isFieldEmployeeRole } from '@/lib/tenant/fieldEmployeeAccess';
import type { TenantRole } from '@/lib/auth/types';
import { geocodeUsAddress } from '@/lib/geo/censusGeocode';
import { syncedFullNameFromParts } from '@/lib/people/personName';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';
import { formatSuggestionClock, loadDaySchedulingSuggestions, suggestionWindowIso } from '@/lib/schedule/optimizer/loadDay';
import { applyVisitAssignees } from '@/lib/schedule/applyVisitAssignees';
import { applyVisitScheduleTime } from '@/lib/schedule/applyVisitScheduleTime';
import { localWallClockInTimeZoneToUtcIso } from '@/lib/schedule/nextWorkDayVisitWindow';
import {
  planFillPeriod,
  resolveFillBounds,
  type FillConsultationDemand,
  type FillProposal,
  type FillScope,
  type FillServiceDemand,
  type FillSkip,
} from '@/lib/schedule/fillPeriod';
import { assertMeteredLimit } from '@/lib/billing/checkLimit';
import { DEFAULT_CONSULTATION_DURATION_MINUTES } from '@/lib/tenant/consultationDuration';
import type { QuoteLineFrequency } from '@/lib/tenant/quoteLineFrequency';
import { WORK_WEEK_DAY_KEYS, type WorkWeekDayKey } from '@/lib/tenant/tenantBusinessSettings';
import type { Database } from '@/lib/supabase/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

type Admin = SupabaseClient<Database>;

export type FillPreviewRow = {
  key: string;
  customerName: string;
  title: string;
  dateKey: string;
  timeLabel: string;
  kind: 'service' | 'consultation';
};

export type FillScheduleState = {
  error?: string;
  start?: string;
  end?: string;
  proposals?: FillPreviewRow[];
  skipped?: FillSkip[];
  committed?: { created: number; assigned: number; open: number };
};

const FREQUENCIES = new Set<QuoteLineFrequency>([
  'one_time',
  'weekly',
  'biweekly',
  'monthly',
  'custom',
]);

function dateKeyInZone(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso));
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}`;
}

function hmToMinutes(raw: string | null | undefined, fallback: number): number {
  const match = String(raw ?? '').match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  return Number(match[1]) * 60 + Number(match[2]);
}

function durationMinutes(hours: number | null): number {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return 120;
  return Math.min(480, Math.max(30, Math.round(hours * 60)));
}

function splitPersonName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || 'Customer', last: parts.slice(1).join(' ') };
}

async function buildPlan(
  admin: Admin,
  tenantId: string,
  scope: FillScope,
  anchorDate: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<
  | { error: string }
  | {
      timeZone: string;
      start: string;
      end: string;
      proposals: FillProposal[];
      skipped: FillSkip[];
      workStartMin: number;
      workEndMin: number;
    }
> {
  const [{ data: tenant }, { data: ops }, { data: quotes }, { data: leads }] = await Promise.all([
    admin
      .from('tenants')
      .select('timezone, work_week_days, work_day_start, work_day_end')
      .eq('id', tenantId)
      .maybeSingle(),
    admin
      .from('tenant_operational_settings')
      .select('consultation_duration_minutes')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    admin
      .from('tenant_quotes')
      .select(
        `
        id,
        title,
        customer_id,
        property_id,
        customers (
          status,
          customer_identities ( first_name, last_name, full_name )
        ),
        tenant_quote_line_items (
          id,
          service_label,
          frequency,
          amount_cents,
          estimated_hours
        )
      `,
      )
      .eq('tenant_id', tenantId)
      .eq('status', 'accepted')
      .is('superseded_by_quote_id', null),
    admin
      .from('tenant_marketing_leads')
      .select(
        'id, name, email, phone, message, status, customer_id, service_address_line1, service_city, service_state, service_postal_code, preferred_time_window',
      )
      .eq('tenant_id', tenantId)
      .eq('status', 'new')
      .order('created_at', { ascending: true })
      .limit(100),
  ]);

  if (!tenant) return { error: 'Workspace not found.' };
  const timeZone = tenant.timezone?.trim() || 'America/New_York';
  const today = dateKeyInZone(new Date().toISOString(), timeZone);
  const bounds = resolveFillBounds({
    scope,
    anchorDate,
    rangeStart,
    rangeEnd,
    today,
  });
  if ('error' in bounds) return bounds;

  const workDays = (tenant.work_week_days ?? ['mon', 'tue', 'wed', 'thu', 'fri']).filter(
    (day): day is WorkWeekDayKey => (WORK_WEEK_DAY_KEYS as readonly string[]).includes(day),
  );
  const workStartMin = hmToMinutes(tenant.work_day_start, 8 * 60);
  const workEndMin = hmToMinutes(tenant.work_day_end, 17 * 60);
  const consultMinutes = ops?.consultation_duration_minutes ?? DEFAULT_CONSULTATION_DURATION_MINUTES;

  const activeQuotes = (quotes ?? []).filter((quote) => {
    const customer = quote.customers;
    return Boolean(quote.customer_id) && customer?.status === 'active';
  });
  const customerIds = [...new Set(activeQuotes.map((quote) => quote.customer_id as string))];

  const [{ data: visits }, { data: prefs }] = await Promise.all([
    customerIds.length
      ? admin
          .from('tenant_scheduled_visits')
          .select('customer_id, quote_line_item_id, starts_at, visit_purpose, status')
          .eq('tenant_id', tenantId)
          .in('customer_id', customerIds)
          .neq('status', 'cancelled')
          .limit(5000)
      : Promise.resolve({ data: [] }),
    customerIds.length
      ? admin
          .from('tenant_customer_scheduling_preferences')
          .select('customer_id, arrival_start')
          .eq('tenant_id', tenantId)
          .in('customer_id', customerIds)
      : Promise.resolve({ data: [] }),
  ]);

  const arrivalByCustomer = new Map(
    (prefs ?? []).map((row) => [row.customer_id, hmToMinutes(row.arrival_start, workStartMin)]),
  );
  const serviceDates = new Map<string, string[]>();
  const lineDates = new Map<string, string[]>();
  const consultationCustomers = new Set<string>();
  for (const visit of visits ?? []) {
    if (!visit.customer_id) continue;
    const dateKey = dateKeyInZone(visit.starts_at, timeZone);
    if (visit.visit_purpose === 'consultation' && visit.status === 'scheduled') {
      consultationCustomers.add(visit.customer_id);
      continue;
    }
    const dates = serviceDates.get(visit.customer_id) ?? [];
    dates.push(dateKey);
    serviceDates.set(visit.customer_id, dates);
    if (visit.quote_line_item_id) {
      const line = lineDates.get(visit.quote_line_item_id) ?? [];
      line.push(dateKey);
      lineDates.set(visit.quote_line_item_id, line);
    }
  }

  const services: FillServiceDemand[] = [];
  for (const quote of activeQuotes) {
    const customerId = quote.customer_id as string;
    const identity = quote.customers?.customer_identities;
    const customerName = identity ? formatCustomerDisplayName(identity) : 'Customer';
    const allDates = serviceDates.get(customerId) ?? [];
    const anchorDateForCustomer = allDates.slice().sort().at(-1) ?? null;
    for (const line of quote.tenant_quote_line_items ?? []) {
      const frequency = FREQUENCIES.has(line.frequency as QuoteLineFrequency)
        ? (line.frequency as QuoteLineFrequency)
        : 'one_time';
      const ownDates = lineDates.get(line.id) ?? [];
      services.push({
        key: line.id,
        customerId,
        customerName,
        title: line.service_label?.trim() || quote.title?.trim() || 'Visit',
        frequency,
        durationMinutes: durationMinutes(line.estimated_hours),
        anchorDate: (frequency === 'one_time' ? ownDates : allDates).slice().sort().at(-1) ?? anchorDateForCustomer,
        existingDates: frequency === 'one_time' ? ownDates : allDates,
        arrivalStartMin: arrivalByCustomer.get(customerId) ?? null,
        quoteId: quote.id,
        lineId: line.id,
        propertyId: quote.property_id,
        amountCents: line.amount_cents,
      });
    }
  }

  const seenEmails = new Set<string>();
  const consultations: FillConsultationDemand[] = [];
  const duplicateLeads: FillSkip[] = [];
  for (const lead of leads ?? []) {
    const email = lead.email.trim().toLowerCase();
    if (seenEmails.has(email)) {
      duplicateLeads.push({
        label: lead.name.trim() || 'Lead',
        reason: 'Another open lead with this email is already included.',
      });
      continue;
    }
    seenEmails.add(email);
    const preferred = lead.message?.match(/Preferred date:\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
    consultations.push({
      key: lead.id,
      leadId: lead.id,
      customerId: lead.customer_id,
      customerName: lead.name.trim() || 'Lead',
      preferredDate: preferred,
      preferredWindow: lead.preferred_time_window,
      durationMinutes: consultMinutes,
      alreadyBooked: Boolean(lead.customer_id && consultationCustomers.has(lead.customer_id)),
    });
  }

  const planned = planFillPeriod({
    start: bounds.start,
    end: bounds.end,
    workDays: workDays.length ? workDays : ['mon', 'tue', 'wed', 'thu', 'fri'],
    workStartMin,
    workEndMin: workEndMin > workStartMin ? workEndMin : workStartMin + 60,
    services,
    consultations,
  });

  return {
    timeZone,
    start: bounds.start,
    end: bounds.end,
    proposals: planned.proposals,
    skipped: [...duplicateLeads, ...planned.skipped],
    workStartMin,
    workEndMin,
  };
}

function windowFor(proposal: FillProposal, timeZone: string): { startsAt: string; endsAt: string } | null {
  const [year, month, day] = proposal.dateKey.split('-').map(Number);
  const startsAt = localWallClockInTimeZoneToUtcIso(timeZone, {
    year: year!,
    month: month!,
    day: day!,
    hour: Math.floor(proposal.startMin / 60),
    minute: proposal.startMin % 60,
  });
  const endMin = proposal.startMin + proposal.durationMinutes;
  const endsAt = localWallClockInTimeZoneToUtcIso(timeZone, {
    year: year!,
    month: month!,
    day: day!,
    hour: Math.floor(endMin / 60),
    minute: endMin % 60,
  });
  if (!startsAt || !endsAt) return null;
  return { startsAt, endsAt };
}

async function ensureLeadCustomer(
  admin: Admin,
  tenantId: string,
  leadId: string,
): Promise<{ customerId: string; propertyId: string | null } | { error: string }> {
  const { data: lead } = await admin
    .from('tenant_marketing_leads')
    .select(
      'id, name, email, phone, customer_id, service_address_line1, service_city, service_state, service_postal_code',
    )
    .eq('id', leadId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!lead) return { error: 'Lead not found.' };

  if (lead.customer_id) {
    const { data: property } = await admin
      .from('tenant_customer_properties')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('customer_id', lead.customer_id)
      .order('is_primary', { ascending: false })
      .limit(1)
      .maybeSingle();
    return { customerId: lead.customer_id, propertyId: property?.id ?? null };
  }

  const email = lead.email.trim().toLowerCase();
  const { data: existing } = await admin
    .from('customers')
    .select('id, customer_identities!inner ( email )')
    .eq('tenant_id', tenantId)
    .ilike('customer_identities.email', email)
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await admin
      .from('tenant_marketing_leads')
      .update({ customer_id: existing.id })
      .eq('id', lead.id)
      .eq('tenant_id', tenantId);
    const { data: property } = await admin
      .from('tenant_customer_properties')
      .select('id')
      .eq('customer_id', existing.id)
      .order('is_primary', { ascending: false })
      .limit(1)
      .maybeSingle();
    return { customerId: existing.id, propertyId: property?.id ?? null };
  }

  try {
    await assertMeteredLimit(admin, tenantId, 'maxActiveCustomers', 1);
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Customer limit reached.' };
  }

  const { first, last } = splitPersonName(lead.name);
  const identity = await admin
    .from('customer_identities')
    .insert({
      email,
      first_name: first,
      last_name: last || null,
      full_name: syncedFullNameFromParts(first, last),
      phone: lead.phone,
    })
    .select('id')
    .single();
  if (identity.error || !identity.data) {
    return { error: identity.error?.message ?? 'Could not create a customer for this lead.' };
  }

  const customer = await admin
    .from('customers')
    .insert({
      tenant_id: tenantId,
      customer_identity_id: identity.data.id,
      status: 'active',
    })
    .select('id')
    .single();
  if (customer.error || !customer.data) {
    await admin.from('customer_identities').delete().eq('id', identity.data.id);
    return { error: customer.error?.message ?? 'Could not create a customer for this lead.' };
  }

  const link = await admin.from('customer_tenant_links').insert({
    customer_identity_id: identity.data.id,
    tenant_id: tenantId,
    customer_id: customer.data.id,
    is_primary: true,
  });
  if (link.error) {
    await admin.from('customers').delete().eq('id', customer.data.id);
    await admin.from('customer_identities').delete().eq('id', identity.data.id);
    return { error: link.error.message };
  }

  const point = await geocodeUsAddress({
    line1: lead.service_address_line1 ?? '',
    city: lead.service_city ?? '',
    state: lead.service_state ?? '',
    postalCode: lead.service_postal_code ?? '',
  });
  const property = await admin
    .from('tenant_customer_properties')
    .insert({
      tenant_id: tenantId,
      customer_id: customer.data.id,
      label: 'Primary service location',
      property_kind: 'residential',
      address_line1: lead.service_address_line1,
      city: lead.service_city,
      state: lead.service_state,
      postal_code: lead.service_postal_code,
      community_name: '',
      latitude: point?.lat ?? null,
      longitude: point?.lng ?? null,
      is_primary: true,
    })
    .select('id')
    .single();

  await admin
    .from('tenant_marketing_leads')
    .update({ customer_id: customer.data.id, status: 'contacted' })
    .eq('id', lead.id)
    .eq('tenant_id', tenantId);

  return { customerId: customer.data.id, propertyId: property.data?.id ?? null };
}

function parseScope(raw: string): FillScope | null {
  if (raw === 'day' || raw === 'week' || raw === 'month' || raw === 'range') return raw;
  return null;
}

export async function fillScheduleAction(
  _prev: FillScheduleState,
  formData: FormData,
): Promise<FillScheduleState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const membership = await requireTenantPortalAccess(slug, '/schedule/fill');
  if (isFieldEmployeeRole(membership.role as TenantRole)) {
    return { error: 'Only the office can fill the schedule.' };
  }

  const scope = parseScope(String(formData.get('scope') ?? ''));
  if (!scope) return { error: 'Choose a day, week, month, or date range.' };

  const admin = createAdminClient();
  const plan = await buildPlan(
    admin,
    membership.tenantId,
    scope,
    String(formData.get('anchor_date') ?? '').trim(),
    String(formData.get('range_start') ?? '').trim(),
    String(formData.get('range_end') ?? '').trim(),
  );
  if ('error' in plan) return { error: plan.error };

  const rows: FillPreviewRow[] = plan.proposals.map((proposal) => ({
    key: proposal.key,
    customerName: proposal.customerName,
    title: proposal.title,
    dateKey: proposal.dateKey,
    timeLabel: formatSuggestionClock(proposal.startMin),
    kind: proposal.kind,
  }));

  if (String(formData.get('intent') ?? '') !== 'commit') {
    return {
      start: plan.start,
      end: plan.end,
      proposals: rows,
      skipped: plan.skipped.slice(0, 12),
    };
  }

  if (plan.proposals.length === 0) {
    return { error: 'Nothing in that period is ready to schedule.', skipped: plan.skipped.slice(0, 12) };
  }

  const createdIds = new Set<string>();
  const createdDates = new Set<string>();
  for (const proposal of plan.proposals) {
    let customerId = proposal.customerId;
    let propertyId = proposal.propertyId;
    if (proposal.kind === 'consultation' && proposal.leadId) {
      const linked = await ensureLeadCustomer(admin, membership.tenantId, proposal.leadId);
      if ('error' in linked) continue;
      customerId = linked.customerId;
      propertyId = linked.propertyId;
      await admin
        .from('tenant_marketing_leads')
        .update({ status: 'contacted', customer_id: customerId })
        .eq('id', proposal.leadId)
        .eq('tenant_id', membership.tenantId);
    }
    if (!customerId) continue;
    const window = windowFor(proposal, plan.timeZone);
    if (!window) continue;
    const inserted = await admin
      .from('tenant_scheduled_visits')
      .insert({
        tenant_id: membership.tenantId,
        customer_id: customerId,
        property_id: propertyId,
        quote_id: proposal.quoteId,
        quote_line_item_id: proposal.lineId,
        title: proposal.title.slice(0, 200),
        starts_at: window.startsAt,
        ends_at: window.endsAt,
        status: 'scheduled',
        staffing_status: 'needs_staffing',
        visit_purpose: proposal.kind,
        expected_amount_cents: proposal.amountCents,
        notes:
          proposal.kind === 'consultation'
            ? 'Consultation requested from a website lead.'
            : 'Placed by Fill schedule from an accepted quote.',
      })
      .select('id')
      .single();
    if (inserted.data?.id) {
      createdIds.add(inserted.data.id);
      createdDates.add(proposal.dateKey);
    }
  }

  let assigned = 0;
  for (const dateKey of createdDates) {
    const day = await loadDaySchedulingSuggestions(admin, {
      tenantId: membership.tenantId,
      dateKey,
      timeZone: plan.timeZone,
    }).catch(() => ({ suggestions: [], gaps: [] }));
    for (const suggestion of day.suggestions) {
      if (!createdIds.has(suggestion.visitId) || suggestion.userIds.length === 0) continue;
      const window = suggestionWindowIso({
        dateKey,
        startMin: suggestion.startMin,
        endMin: suggestion.endMin,
        timeZone: plan.timeZone,
      });
      if (!window) continue;
      const timed = await applyVisitScheduleTime(admin, {
        tenantId: membership.tenantId,
        visitId: suggestion.visitId,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        confirmOverlap: false,
        confirmUnavailable: false,
        tenantTimezone: plan.timeZone,
      });
      const timeOk =
        timed.ok ||
        (
          await applyVisitScheduleTime(admin, {
            tenantId: membership.tenantId,
            visitId: suggestion.visitId,
            startsAt: window.startsAt,
            endsAt: window.endsAt,
            confirmOverlap: true,
            confirmUnavailable: true,
            tenantTimezone: plan.timeZone,
          })
        ).ok;
      if (!timeOk) continue;
      const crew = await applyVisitAssignees(admin, {
        tenantId: membership.tenantId,
        visitId: suggestion.visitId,
        assigneeUserIds: suggestion.userIds,
        confirmOverlap: false,
        confirmUnavailable: false,
        tenantTimezone: plan.timeZone,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
      });
      const crewOk =
        crew.ok ||
        (
          await applyVisitAssignees(admin, {
            tenantId: membership.tenantId,
            visitId: suggestion.visitId,
            assigneeUserIds: suggestion.userIds,
            confirmOverlap: true,
            confirmUnavailable: true,
            tenantTimezone: plan.timeZone,
            startsAt: window.startsAt,
            endsAt: window.endsAt,
          })
        ).ok;
      if (crewOk) assigned += 1;
    }
  }

  revalidatePath('/tenant/schedule');
  revalidatePath('/tenant/customers');
  return {
    start: plan.start,
    end: plan.end,
    committed: {
      created: createdIds.size,
      assigned,
      open: createdIds.size - assigned,
    },
  };
}
