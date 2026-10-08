import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { loadEffectiveSchedulesForMembers } from '@/lib/schedule/memberScheduleProfile';
import { factorLabel, planOptimizedDay, topContributions } from '@/lib/schedule/optimizer/planDay';
import {
  effectiveSchedulingFacts,
  emptySchedulingFacts,
  schedulingFactsFromRow,
  type SchedulingFacts,
  type SchedulingFactsRow,
} from '@/lib/schedule/optimizer/preferences';
import { resolveScheduleOptimizerPolicy } from '@/lib/schedule/optimizer/policy';
import type {
  ExperienceLevel,
  OptimizerCrewMember,
  OptimizerExistingJob,
  OptimizerJob,
} from '@/lib/schedule/optimizer/types';
import { localWallClockInTimeZoneToUtcIso } from '@/lib/schedule/nextWorkDayVisitWindow';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';
import { shiftDateKey } from '@/lib/tenant/scheduleDateRange';
import type { WorkWeekDayKey } from '@/lib/tenant/tenantBusinessSettings';

type Admin = SupabaseClient<Database>;

const WEEKDAY_SHORT_TO_KEY: Record<string, WorkWeekDayKey> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
  Sun: 'sun',
};

export type DaySchedulingSuggestion = {
  visitId: string;
  title: string;
  customerName: string;
  startMin: number;
  endMin: number;
  userIds: string[];
  crewNames: string[];
  reasons: string[];
};

export type DaySchedulingGap = {
  visitId: string;
  title: string;
  customerName: string;
  reasons: string[];
};

export type DaySchedulingPlan = {
  suggestions: DaySchedulingSuggestion[];
  gaps: DaySchedulingGap[];
};

function zonedParts(at: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(at);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const hour = Number(read('hour'));
  return {
    dateKey: `${read('year')}-${read('month')}-${read('day')}`,
    minutes: (hour === 24 ? 0 : hour) * 60 + Number(read('minute')),
    dayKey: WEEKDAY_SHORT_TO_KEY[read('weekday').slice(0, 3)] ?? 'mon',
    weekday: read('weekday').slice(0, 3),
  };
}

function hmToMinutes(raw: string): number {
  const match = raw.trim().match(/^(\d{2}):(\d{2})/);
  if (!match) return 8 * 60;
  return Number(match[1]) * 60 + Number(match[2]);
}

function clipIntervalToDay(
  startsAt: string,
  endsAt: string,
  dateKey: string,
  timeZone: string,
): { startMin: number; endMin: number } | null {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    return null;
  }
  const startParts = zonedParts(start, timeZone);
  const endParts = zonedParts(new Date(end.getTime() - 1), timeZone);
  if (startParts.dateKey > dateKey || endParts.dateKey < dateKey) return null;
  const startMin = startParts.dateKey === dateKey ? startParts.minutes : 0;
  const endMin = endParts.dateKey === dateKey ? zonedParts(end, timeZone).minutes : 24 * 60;
  if (endMin <= startMin) return null;
  return { startMin, endMin };
}

function experienceLevel(raw: string | null | undefined): ExperienceLevel {
  if (raw === 'new' || raw === 'lead') return raw;
  return 'standard';
}

function formatMinutes(minutes: number): string {
  const hour24 = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour = hour24 % 12 || 12;
  return `${hour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function suggestionWindowIso(input: {
  dateKey: string;
  startMin: number;
  endMin: number;
  timeZone: string;
}): { startsAt: string; endsAt: string } | null {
  const [year, month, day] = input.dateKey.split('-').map(Number);
  if (!year || !month || !day) return null;
  const startsAt = localWallClockInTimeZoneToUtcIso(input.timeZone, {
    year,
    month,
    day,
    hour: Math.floor(input.startMin / 60),
    minute: input.startMin % 60,
  });
  const endsAt = localWallClockInTimeZoneToUtcIso(input.timeZone, {
    year,
    month,
    day,
    hour: Math.floor(input.endMin / 60),
    minute: input.endMin % 60,
  });
  if (!startsAt || !endsAt) return null;
  return { startsAt, endsAt };
}

type VisitRow = {
  id: string;
  customer_id: string;
  property_id: string | null;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  visit_purpose: string;
  expected_amount_cents: number | null;
  recurring_rule_id: string | null;
  tenant_scheduled_visit_assignees: { user_id: string }[] | null;
};

/**
 * Builds suggestions for visits on this calendar day that still need a cleaner.
 * Visits that already have a crew stay pinned and are not moved.
 */
export async function loadDaySchedulingSuggestions(
  admin: Admin,
  input: { tenantId: string; dateKey: string; timeZone: string },
): Promise<DaySchedulingPlan> {
  const empty = { suggestions: [], gaps: [] };
  const { tenantId, dateKey, timeZone } = input;
  const dayStart = suggestionWindowIso({ dateKey, startMin: 0, endMin: 60, timeZone });
  if (!dayStart) return empty;
  const dayStartIso = dayStart.startsAt;
  const nextKey = shiftDateKey(dateKey, 1);
  const [nextYear, nextMonth, nextDay] = nextKey.split('-').map(Number);
  const dayEndIso =
    localWallClockInTimeZoneToUtcIso(timeZone, {
      year: nextYear ?? 0,
      month: nextMonth ?? 1,
      day: nextDay ?? 1,
      hour: 0,
      minute: 0,
    }) ?? new Date(Date.parse(dayStartIso) + 24 * 60 * 60 * 1000).toISOString();

  const [{ data: policyRow }, { data: tenantRow }, { data: members }] = await Promise.all([
    admin
      .from('tenant_operational_settings')
      .select('schedule_optimizer_policy')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
    admin.from('tenants').select('latitude, longitude').eq('id', tenantId).maybeSingle(),
    admin
      .from('tenant_memberships')
      .select('user_id, role')
      .eq('tenant_id', tenantId)
      .eq('is_active', true),
  ]);

  const userIds = [...new Set((members ?? []).map((member) => member.user_id))];
  if (userIds.length === 0) return empty;

  const since = new Date(Date.parse(dayStartIso) - 56 * 24 * 60 * 60 * 1000).toISOString();
  const [
    schedules,
    { data: profiles },
    { data: names },
    { data: timeOff },
    { data: visits },
    { data: history },
  ] = await Promise.all([
    loadEffectiveSchedulesForMembers(admin, tenantId, userIds),
    admin.from('tenant_member_scheduling_profiles').select('*').eq('tenant_id', tenantId),
    admin.from('user_profiles').select('user_id, display_name').in('user_id', userIds),
    admin
      .from('tenant_member_time_off')
      .select('user_id, starts_at, ends_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'approved')
      .lt('starts_at', dayEndIso)
      .gt('ends_at', dayStartIso),
    admin
      .from('tenant_scheduled_visits')
      .select(
        'id, customer_id, property_id, title, starts_at, ends_at, status, visit_purpose, expected_amount_cents, recurring_rule_id, tenant_scheduled_visit_assignees(user_id)',
      )
      .eq('tenant_id', tenantId)
      .eq('status', 'scheduled')
      .lt('starts_at', dayEndIso)
      .gt('ends_at', dayStartIso),
    admin
      .from('tenant_scheduled_visits')
      .select(
        'customer_id, recurring_rule_id, starts_at, status, visit_purpose, tenant_scheduled_visit_assignees(user_id)',
      )
      .eq('tenant_id', tenantId)
      .gte('starts_at', since)
      .lt('starts_at', dayStartIso)
      .neq('status', 'cancelled')
      .limit(1000),
  ]);

  const profileByUser = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
  const nameByUser = new Map(
    (names ?? []).map((profile) => [
      profile.user_id,
      profile.display_name?.trim() || 'Team member',
    ]),
  );
  const office =
    tenantRow?.latitude != null && tenantRow.longitude != null
      ? { lat: tenantRow.latitude, lng: tenantRow.longitude }
      : null;

  const probe = zonedParts(new Date(dayStartIso), timeZone);
  const weekendCounts = new Map<string, number>();
  const lastAssigneeByRule = new Map<string, string>();
  const customersWithHistory = new Set<string>();
  const historyRows = [...(history ?? [])].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  for (const row of historyRows) {
    if (row.status === 'completed' && row.visit_purpose !== 'consultation') {
      customersWithHistory.add(row.customer_id);
    }
    const assignee = row.tenant_scheduled_visit_assignees?.[0]?.user_id;
    if (row.recurring_rule_id && assignee) lastAssigneeByRule.set(row.recurring_rule_id, assignee);
    if (!assignee) continue;
    const when = zonedParts(new Date(row.starts_at), timeZone);
    if (when.weekday === 'Sat' || when.weekday === 'Sun') {
      weekendCounts.set(assignee, (weekendCounts.get(assignee) ?? 0) + 1);
    }
  }

  const dayVisits = (visits ?? []) as VisitRow[];
  const openVisits = dayVisits.filter(
    (visit) => (visit.tenant_scheduled_visit_assignees ?? []).length === 0,
  );
  if (openVisits.length === 0) return empty;

  const propertyIds = [
    ...new Set(dayVisits.map((visit) => visit.property_id).filter(Boolean)),
  ] as string[];
  const customerIds = [...new Set(dayVisits.map((visit) => visit.customer_id))];
  const ruleIds = [
    ...new Set(openVisits.map((visit) => visit.recurring_rule_id).filter(Boolean)),
  ] as string[];

  const [{ data: properties }, { data: customerPrefs }, { data: customers }, { data: rules }] =
    await Promise.all([
      propertyIds.length
        ? admin
            .from('tenant_customer_properties')
            .select(
              'id, property_kind, postal_code, service_zone_id, building_name, latitude, longitude, scheduling_override',
            )
            .in('id', propertyIds)
        : Promise.resolve({ data: [] }),
      admin
        .from('tenant_customer_scheduling_preferences')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('customer_id', customerIds),
      admin
        .from('customers')
        .select('id, customer_identities(first_name, last_name, full_name)')
        .in('id', customerIds),
      ruleIds.length
        ? admin.from('recurring_appointment_rules').select('id, anchor_starts_at').in('id', ruleIds)
        : Promise.resolve({ data: [] }),
    ]);

  const propertyById = new Map((properties ?? []).map((property) => [property.id, property]));
  const prefsByCustomer = new Map(
    (customerPrefs ?? []).map((row) => [
      row.customer_id,
      schedulingFactsFromRow(row as SchedulingFactsRow),
    ]),
  );
  const customerName = new Map(
    (customers ?? []).map((customer) => {
      const identity = Array.isArray(customer.customer_identities)
        ? customer.customer_identities[0]
        : customer.customer_identities;
      return [customer.id, formatCustomerDisplayName(identity ?? {})] as const;
    }),
  );
  const anchorByRule = new Map(
    (rules ?? []).map((rule) => {
      const parts = zonedParts(new Date(rule.anchor_starts_at), timeZone);
      return [rule.id, parts.minutes] as const;
    }),
  );

  const existingByUser = new Map<string, OptimizerExistingJob[]>();
  for (const visit of dayVisits) {
    const assignees = visit.tenant_scheduled_visit_assignees ?? [];
    if (assignees.length === 0) continue;
    const span = clipIntervalToDay(visit.starts_at, visit.ends_at, dateKey, timeZone);
    if (!span) continue;
    const property = visit.property_id ? propertyById.get(visit.property_id) : undefined;
    const block: OptimizerExistingJob = {
      id: visit.id,
      startMin: span.startMin,
      endMin: span.endMin,
      location:
        property?.latitude != null && property.longitude != null
          ? { lat: property.latitude, lng: property.longitude }
          : null,
      zoneId: property?.service_zone_id ?? null,
      postalCode: property?.postal_code ?? null,
      buildingKey: property?.building_name?.trim() || null,
    };
    for (const assignee of assignees) {
      const list = existingByUser.get(assignee.user_id) ?? [];
      list.push(block);
      existingByUser.set(assignee.user_id, list);
    }
  }

  const crew: OptimizerCrewMember[] = userIds.map((userId) => {
    const profile = profileByUser.get(userId);
    const schedule = schedules.get(userId);
    const window = schedule?.dayWindows[probe.dayKey];
    const home =
      profile?.home_latitude != null && profile.home_longitude != null
        ? { lat: profile.home_latitude, lng: profile.home_longitude }
        : null;
    return {
      userId,
      home,
      office,
      availableStartMin: window ? hmToMinutes(window.startsAt) : 0,
      availableEndMin: window ? hmToMinutes(window.endsAt) : 0,
      timeOff: (timeOff ?? [])
        .filter((row) => row.user_id === userId)
        .map((row) => clipIntervalToDay(row.starts_at, row.ends_at, dateKey, timeZone))
        .filter((span): span is { startMin: number; endMin: number } => Boolean(span)),
      existingJobs: existingByUser.get(userId) ?? [],
      skillTags: profile?.skill_tags ?? [],
      certificationTags: profile?.certification_tags ?? [],
      equipmentTags: profile?.equipment_tags ?? [],
      attributeTags: profile?.attribute_tags ?? [],
      languageCodes: profile?.language_codes ?? [],
      propertyKinds: profile?.property_kinds ?? [],
      handlesPets: profile?.handles_pets ?? true,
      handlesChemicalSensitivity: profile?.handles_chemical_sensitivity ?? true,
      maxJobsPerDay: profile?.max_jobs_per_day ?? null,
      maxMinutesPerDay: profile?.max_minutes_per_day ?? null,
      maxDriveMinutesBetweenStops: profile?.max_drive_minutes ?? null,
      preferredZoneIds: profile?.preferred_zone_ids ?? [],
      preferredPartnerIds: profile?.preferred_partner_ids ?? [],
      avoidPartnerIds: profile?.avoid_partner_ids ?? [],
      experienceLevel: experienceLevel(profile?.experience_level),
      priorWeekendJobs: weekendCounts.get(userId) ?? 0,
      isWeekend: probe.weekday === 'Sat' || probe.weekday === 'Sun',
    };
  });

  const jobs: OptimizerJob[] = [];
  const meta = new Map<string, { title: string; customerName: string }>();
  for (const visit of openVisits) {
    const span = clipIntervalToDay(visit.starts_at, visit.ends_at, dateKey, timeZone);
    if (!span) continue;
    const property = visit.property_id ? propertyById.get(visit.property_id) : undefined;
    const facts: SchedulingFacts = effectiveSchedulingFacts(
      prefsByCustomer.get(visit.customer_id) ?? emptySchedulingFacts(),
      property?.scheduling_override,
    );
    const duration = Math.max(15, span.endMin - span.startMin);
    jobs.push({
      id: visit.id,
      durationMinutes: duration,
      location:
        property?.latitude != null && property.longitude != null
          ? { lat: property.latitude, lng: property.longitude }
          : null,
      zoneId: property?.service_zone_id ?? null,
      postalCode: property?.postal_code ?? null,
      buildingKey: property?.building_name?.trim() || null,
      propertyKind: property?.property_kind ?? 'residential',
      preferredUserIds: facts.preferredUserIds,
      requiredUserIds: facts.requiredUserIds,
      blockedUserIds: facts.blockedUserIds,
      requiredSkillTags: facts.requiredSkillTags,
      requiredCertificationTags: facts.requiredCertificationTags,
      requiredEquipmentTags: facts.requiredEquipmentTags,
      requiredAttributeTags: facts.requiredAttributeTags,
      languageCodes: facts.languageCodes,
      petInHome: facts.petInHome,
      chemicalSensitivity: facts.chemicalSensitivity,
      requiredCrewSize: facts.requiredCrewSize,
      arrivalWindow: facts.arrivalWindow,
      accessWindow: facts.accessWindow,
      priority: facts.priority,
      revenueCents: visit.expected_amount_cents ?? 0,
      recurringAnchorUserId: visit.recurring_rule_id
        ? (lastAssigneeByRule.get(visit.recurring_rule_id) ?? null)
        : null,
      standingStartMin: visit.recurring_rule_id
        ? (anchorByRule.get(visit.recurring_rule_id) ?? null)
        : null,
      isFirstVisit:
        visit.visit_purpose === 'consultation' || !customersWithHistory.has(visit.customer_id),
      requiresKeyPickup: facts.requiresKeyPickup,
      lockedAssigneeIds: null,
      lockedStartMin: null,
    });
    meta.set(visit.id, {
      title: visit.title || 'Visit',
      customerName: customerName.get(visit.customer_id) ?? 'Customer',
    });
  }

  if (jobs.length === 0) return empty;

  const plan = planOptimizedDay({
    jobs,
    crew,
    policy: resolveScheduleOptimizerPolicy(policyRow?.schedule_optimizer_policy),
  });

  const suggestions: DaySchedulingSuggestion[] = plan.assignments.map((assignment) => {
    const info = meta.get(assignment.jobId);
    return {
      visitId: assignment.jobId,
      title: info?.title ?? 'Visit',
      customerName: info?.customerName ?? 'Customer',
      startMin: assignment.startMin,
      endMin: assignment.endMin,
      userIds: assignment.userIds,
      crewNames: assignment.userIds.map((id) => nameByUser.get(id) ?? 'Team member'),
      reasons: topContributions(assignment, 3).map(
        (entry) => `${factorLabel(entry.factorId)}: ${entry.note}`,
      ),
    };
  });

  const gaps: DaySchedulingGap[] = plan.unassigned.map((item) => {
    const info = meta.get(item.jobId);
    return {
      visitId: item.jobId,
      title: info?.title ?? 'Visit',
      customerName: info?.customerName ?? 'Customer',
      reasons: item.reasons,
    };
  });

  return { suggestions, gaps };
}

export function formatSuggestionClock(minutes: number): string {
  return formatMinutes(minutes);
}
