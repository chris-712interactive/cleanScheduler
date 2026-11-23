import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assertTenantCanCreateAutomationWorkflow,
  automationWorkflowGateErrorMessage,
} from '@/lib/billing/automationWorkflows';
import {
  checkEmployeeAvailability,
  UNAVAILABILITY_LABEL,
} from '@/lib/schedule/employeeAvailability';
import {
  planRecurringSeriesSplit,
  type SeriesSplitPlan,
  type SplitVisit,
} from '@/lib/schedule/recurringSeriesSplit';
import { ineligibleScheduleMessage } from '@/lib/schedule/scheduleEligibility';
import {
  findAssigneeScheduleConflicts,
  type AssigneeConflictInfo,
} from '@/lib/schedule/visitAssigneeConflicts';
import {
  normalizeAssigneeRows,
  type RawScheduleAssigneeRow,
} from '@/lib/schedule/mapAssigneeChips';
import type { ScheduleAssigneeChip } from '@/lib/schedule/assigneeDisplay';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

export type RecurringSeriesEditInput = {
  tenantId: string;
  visitId: string;
  timeZone: string;
  confirmOverlap: boolean;
  confirmUnavailable: boolean;
  /** When set, this visit and later on-grid visits move to this window. */
  startsAt?: string;
  endsAt?: string;
  /** When set, the edited visit's availability check uses this window. */
  availabilityStartsAt?: string;
  availabilityEndsAt?: string;
  title?: string;
  notes?: string | null;
  expectedAmountCents?: number;
  /** Undefined leaves crew alone. An empty list clears crew on this and future visits. */
  assigneeUserIds?: string[];
};

export type RecurringSeriesEditSuccess = {
  ok: true;
  unchanged: boolean;
  newRuleId: string | null;
  customerId: string;
  rewrittenVisitIds: string[];
  cleanerUserIds: string[];
  previousStartsAt: string;
  previous: { title: string; rruleDefinition: string; anchorStartsAt: string };
  next: { title: string; rruleDefinition: string; anchorStartsAt: string };
  edited: {
    startsAt: string;
    endsAt: string;
    title: string;
    notes: string | null;
    expectedAmountCents: number | null;
    assignees: ScheduleAssigneeChip[];
    assigneeUserIds: string[];
  };
};

export type RecurringSeriesEditResult =
  | RecurringSeriesEditSuccess
  | {
      ok: false;
      error: string;
      conflicts?: AssigneeConflictInfo[];
      needsOverlapConfirm?: boolean;
    };

function sameInstant(left: string, right: string): boolean {
  return new Date(left).getTime() === new Date(right).getTime();
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

async function preflightEditedVisit(
  admin: Admin,
  params: {
    tenantId: string;
    visitId: string;
    timeZone: string;
    startsAt: string;
    endsAt: string;
    assigneeUserIds: string[];
    confirmOverlap: boolean;
    confirmUnavailable: boolean;
    visitPurpose: string;
  },
): Promise<RecurringSeriesEditResult | null> {
  const kind = params.visitPurpose === 'consultation' ? 'consultation' : 'service';
  const blocked = await ineligibleScheduleMessage(
    admin,
    params.tenantId,
    params.assigneeUserIds,
    kind,
  );
  if (blocked) return { ok: false, error: blocked };

  if (params.assigneeUserIds.length > 0 && !params.confirmUnavailable) {
    const unavailable: string[] = [];
    for (const userId of params.assigneeUserIds) {
      const result = await checkEmployeeAvailability(admin, {
        tenantId: params.tenantId,
        userId,
        startsAt: params.startsAt,
        endsAt: params.endsAt,
        excludeVisitId: params.visitId,
      });
      if (!result.available) {
        unavailable.push(result.reasons.map((reason) => UNAVAILABILITY_LABEL[reason]).join(', '));
      }
    }
    if (unavailable.length > 0) {
      return {
        ok: false,
        error:
          'Assigned crew are unavailable at this time. Pick a suggested slot below, adjust the time, or confirm scheduling anyway.',
        needsOverlapConfirm: true,
      };
    }
  }

  if (params.assigneeUserIds.length > 0 && !params.confirmOverlap) {
    const conflicts = await findAssigneeScheduleConflicts(admin, {
      tenantId: params.tenantId,
      excludeVisitId: params.visitId,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
      assigneeUserIds: params.assigneeUserIds,
      tenantTimezone: params.timeZone,
    });
    if (conflicts.length > 0) {
      return {
        ok: false,
        error:
          'This time overlaps another visit for assigned crew. Review the conflicts below or confirm double-booking.',
        conflicts,
        needsOverlapConfirm: true,
      };
    }
  }

  return null;
}

/**
 * Ends the series before the edited visit and starts a new series from it.
 * Past, completed, checked-in, and invoiced visits are not updated.
 * Moved future visits keep their window. One caller sends one series summary.
 */
export async function applyRecurringSeriesEdit(
  admin: Admin,
  input: RecurringSeriesEditInput,
): Promise<RecurringSeriesEditResult> {
  const { data: visit, error: visitError } = await admin
    .from('tenant_scheduled_visits')
    .select(
      'id, tenant_id, customer_id, recurring_rule_id, title, notes, starts_at, ends_at, status, checked_in_at, completion_invoice_id, coverage_addon_invoice_id, expected_amount_cents, visit_purpose',
    )
    .eq('id', input.visitId)
    .eq('tenant_id', input.tenantId)
    .maybeSingle();
  if (visitError || !visit) return { ok: false, error: 'Visit not found.' };
  if (!visit.recurring_rule_id) return { ok: false, error: 'This visit is not part of a series.' };
  if (visit.status !== 'scheduled' || visit.checked_in_at) {
    return {
      ok: false,
      error: 'Only an upcoming scheduled visit can change the rest of the series.',
    };
  }

  const { data: rule, error: ruleError } = await admin
    .from('recurring_appointment_rules')
    .select(
      'id, tenant_id, customer_id, property_id, quote_id, expected_amount_cents, title, rrule_definition, anchor_starts_at, visit_duration_minutes, horizon_days, is_active',
    )
    .eq('id', visit.recurring_rule_id)
    .eq('tenant_id', input.tenantId)
    .eq('customer_id', visit.customer_id)
    .maybeSingle();
  if (ruleError || !rule || !rule.is_active) {
    return { ok: false, error: 'Series not found.' };
  }

  const { data: rows, error: rowsError } = await admin
    .from('tenant_scheduled_visits')
    .select(
      'id, starts_at, ends_at, status, checked_in_at, completion_invoice_id, coverage_addon_invoice_id, title, notes, expected_amount_cents',
    )
    .eq('tenant_id', input.tenantId)
    .eq('recurring_rule_id', rule.id);
  if (rowsError) return { ok: false, error: rowsError.message };
  const seriesVisits = rows ?? [];
  const visitIds = seriesVisits.map((row) => row.id);

  const invoiced = new Set<string>();
  if (visitIds.length > 0) {
    const { data: invoices, error: invoiceError } = await admin
      .from('tenant_invoices')
      .select('visit_id')
      .eq('tenant_id', input.tenantId)
      .in('visit_id', visitIds);
    if (invoiceError) return { ok: false, error: invoiceError.message };
    for (const invoice of invoices ?? []) {
      if (invoice.visit_id) invoiced.add(invoice.visit_id);
    }
  }

  const { data: skips, error: skipError } = await admin
    .from('recurring_appointment_occurrence_skips')
    .select('visit_id')
    .eq('recurring_rule_id', rule.id);
  if (skipError) return { ok: false, error: skipError.message };
  const movedVisitIds = (skips ?? [])
    .map((row) => row.visit_id)
    .filter((id): id is string => Boolean(id));

  const splitVisits: SplitVisit[] = seriesVisits.map((row) => ({
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    checkedInAt: row.checked_in_at,
    invoiced:
      invoiced.has(row.id) ||
      row.completion_invoice_id != null ||
      row.coverage_addon_invoice_id != null,
  }));

  const startsAt = input.startsAt ?? visit.starts_at;
  const endsAt = input.endsAt ?? visit.ends_at;
  const plan: SeriesSplitPlan = planRecurringSeriesSplit({
    timeZone: input.timeZone,
    rruleDefinition: rule.rrule_definition,
    anchorStartsAt: rule.anchor_starts_at,
    editedVisitId: visit.id,
    splitStartsAt: visit.starts_at,
    editedStartsAt: startsAt,
    editedEndsAt: endsAt,
    visits: splitVisits,
    movedVisitIds,
    horizonDays: rule.horizon_days,
  });
  if (!plan.ok) return plan;

  const byId = new Map(seriesVisits.map((row) => [row.id, row]));
  const { data: assigneeRows, error: assigneeError } = await admin
    .from('tenant_scheduled_visit_assignees')
    .select('visit_id, user_id')
    .in('visit_id', visitIds.length > 0 ? visitIds : ['00000000-0000-0000-0000-000000000000']);
  if (assigneeError) return { ok: false, error: assigneeError.message };
  const crewByVisit = new Map<string, string[]>();
  for (const row of assigneeRows ?? []) {
    const list = crewByVisit.get(row.visit_id) ?? [];
    list.push(row.user_id);
    crewByVisit.set(row.visit_id, list);
  }

  const nextTitle = input.title ?? visit.title;
  const nextNotes = input.notes === undefined ? visit.notes : input.notes;
  const nextPrice =
    input.expectedAmountCents === undefined
      ? visit.expected_amount_cents
      : input.expectedAmountCents;
  const nextCrew = input.assigneeUserIds;

  const fieldsUnchanged = plan.rewrites.every((rewrite) => {
    const current = byId.get(rewrite.id);
    if (!current) return false;
    if (
      !sameInstant(current.starts_at, rewrite.startsAt) ||
      !sameInstant(current.ends_at, rewrite.endsAt)
    ) {
      return false;
    }
    if (input.title !== undefined && current.title !== nextTitle) return false;
    if (input.notes !== undefined && (current.notes ?? null) !== (nextNotes ?? null)) return false;
    if (input.expectedAmountCents !== undefined && current.expected_amount_cents !== nextPrice) {
      return false;
    }
    if (nextCrew && !sameIds(crewByVisit.get(rewrite.id) ?? [], nextCrew)) return false;
    return true;
  });
  const priceRuleUnchanged =
    input.expectedAmountCents === undefined ||
    rule.expected_amount_cents === input.expectedAmountCents;
  const titleRuleUnchanged = input.title === undefined || rule.title === input.title;

  const editedCrew = crewByVisit.get(visit.id) ?? [];
  const availabilityCrew = nextCrew ?? editedCrew;
  const availabilityStarts = input.availabilityStartsAt ?? startsAt;
  const availabilityEnds = input.availabilityEndsAt ?? endsAt;

  if (fieldsUnchanged && priceRuleUnchanged && titleRuleUnchanged) {
    const chips = await loadChips(admin, visit.id);
    return {
      ok: true,
      unchanged: true,
      newRuleId: null,
      customerId: visit.customer_id,
      rewrittenVisitIds: [],
      cleanerUserIds: editedCrew,
      previousStartsAt: visit.starts_at,
      previous: {
        title: rule.title,
        rruleDefinition: rule.rrule_definition,
        anchorStartsAt: rule.anchor_starts_at,
      },
      next: {
        title: rule.title,
        rruleDefinition: rule.rrule_definition,
        anchorStartsAt: rule.anchor_starts_at,
      },
      edited: {
        startsAt: visit.starts_at,
        endsAt: visit.ends_at,
        title: visit.title,
        notes: visit.notes,
        expectedAmountCents: visit.expected_amount_cents,
        assignees: chips.assignees,
        assigneeUserIds: chips.assigneeUserIds,
      },
    };
  }

  if (nextCrew) {
    for (const userId of nextCrew) {
      const { data: member } = await admin
        .from('tenant_memberships')
        .select('user_id')
        .eq('tenant_id', input.tenantId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .maybeSingle();
      if (!member) {
        return {
          ok: false,
          error: 'One or more crew selections are not active members of this workspace.',
        };
      }
    }
  }

  const blocked = await preflightEditedVisit(admin, {
    tenantId: input.tenantId,
    visitId: visit.id,
    timeZone: input.timeZone,
    startsAt: availabilityStarts,
    endsAt: availabilityEnds,
    assigneeUserIds: availabilityCrew,
    confirmOverlap: input.confirmOverlap,
    confirmUnavailable: input.confirmUnavailable,
    visitPurpose: visit.visit_purpose,
  });
  if (blocked) return blocked;

  if (!plan.deactivateOldSeries) {
    try {
      await assertTenantCanCreateAutomationWorkflow(admin, input.tenantId);
    } catch (error) {
      return {
        ok: false,
        error: automationWorkflowGateErrorMessage(error) ?? 'Could not update the series.',
      };
    }
  }

  const newRuleId = randomUUID();
  const inserted = await admin
    .from('recurring_appointment_rules')
    .insert({
      id: newRuleId,
      tenant_id: input.tenantId,
      customer_id: rule.customer_id,
      property_id: rule.property_id,
      quote_id: rule.quote_id,
      expected_amount_cents:
        input.expectedAmountCents === undefined
          ? rule.expected_amount_cents
          : input.expectedAmountCents,
      title: input.title ?? rule.title,
      rrule_definition: plan.newRrule,
      anchor_starts_at: plan.newAnchorStartsAt,
      visit_duration_minutes: plan.newDurationMinutes,
      horizon_days: rule.horizon_days,
      is_active: true,
    })
    .select('id')
    .single();
  if (inserted.error || !inserted.data) {
    return { ok: false, error: inserted.error?.message ?? 'Could not save the series.' };
  }

  const now = new Date().toISOString();
  for (const rewrite of plan.rewrites) {
    const update: Database['public']['Tables']['tenant_scheduled_visits']['Update'] = {
      recurring_rule_id: newRuleId,
      starts_at: rewrite.startsAt,
      ends_at: rewrite.endsAt,
      updated_at: now,
    };
    if (input.title !== undefined) update.title = nextTitle;
    if (input.notes !== undefined) update.notes = nextNotes;
    if (input.expectedAmountCents !== undefined) update.expected_amount_cents = nextPrice;
    if (nextCrew) {
      update.staffing_status =
        nextCrew.length === 0
          ? 'needs_staffing'
          : input.confirmUnavailable || input.confirmOverlap
            ? 'override_confirmed'
            : 'assigned';
    }
    const saved = await admin
      .from('tenant_scheduled_visits')
      .update(update)
      .eq('id', rewrite.id)
      .eq('tenant_id', input.tenantId)
      .eq('recurring_rule_id', rule.id);
    if (saved.error) return { ok: false, error: saved.error.message };
  }

  if (nextCrew) {
    for (const rewrite of plan.rewrites) {
      const removed = await admin
        .from('tenant_scheduled_visit_assignees')
        .delete()
        .eq('visit_id', rewrite.id);
      if (removed.error) return { ok: false, error: removed.error.message };
      if (nextCrew.length === 0) continue;
      const created = await admin
        .from('tenant_scheduled_visit_assignees')
        .insert(nextCrew.map((userId) => ({ visit_id: rewrite.id, user_id: userId })));
      if (created.error) return { ok: false, error: created.error.message };
    }
  }

  const originalIdByStart = new Map(
    seriesVisits.map((row) => [new Date(row.starts_at).getTime(), row.id]),
  );
  const oldSkipRows = plan.oldSkips.map((startsAt) => ({
    recurring_rule_id: rule.id,
    starts_at: startsAt,
    visit_id: originalIdByStart.get(new Date(startsAt).getTime()) ?? null,
  }));
  const newSkipRows = plan.newSkips.map((startsAt) => ({
    recurring_rule_id: newRuleId,
    starts_at: startsAt,
    visit_id: null,
  }));
  const skipRows = [...oldSkipRows, ...newSkipRows];
  if (skipRows.length > 0) {
    const skipped = await admin
      .from('recurring_appointment_occurrence_skips')
      .upsert(skipRows, { onConflict: 'recurring_rule_id,starts_at', ignoreDuplicates: true });
    if (skipped.error) return { ok: false, error: skipped.error.message };
  }

  const closed = await admin
    .from('recurring_appointment_rules')
    .update({
      rrule_definition: plan.oldRrule,
      is_active: plan.deactivateOldSeries ? false : true,
      updated_at: now,
    })
    .eq('id', rule.id)
    .eq('tenant_id', input.tenantId);
  if (closed.error) return { ok: false, error: closed.error.message };

  const chips = await loadChips(admin, visit.id);
  const editedRewrite = plan.rewrites.find((row) => row.id === visit.id);
  return {
    ok: true,
    unchanged: false,
    newRuleId,
    customerId: visit.customer_id,
    rewrittenVisitIds: plan.rewrites.map((row) => row.id),
    cleanerUserIds: nextCrew ?? editedCrew,
    previousStartsAt: visit.starts_at,
    previous: {
      title: rule.title,
      rruleDefinition: rule.rrule_definition,
      anchorStartsAt: rule.anchor_starts_at,
    },
    next: {
      title: input.title ?? rule.title,
      rruleDefinition: plan.newRrule,
      anchorStartsAt: plan.newAnchorStartsAt,
    },
    edited: {
      startsAt: editedRewrite?.startsAt ?? startsAt,
      endsAt: editedRewrite?.endsAt ?? endsAt,
      title: nextTitle,
      notes: nextNotes,
      expectedAmountCents:
        input.expectedAmountCents === undefined
          ? visit.expected_amount_cents
          : input.expectedAmountCents,
      assignees: chips.assignees,
      assigneeUserIds: chips.assigneeUserIds,
    },
  };
}

async function loadChips(
  admin: Admin,
  visitId: string,
): Promise<{ assignees: ScheduleAssigneeChip[]; assigneeUserIds: string[] }> {
  const { data } = await admin
    .from('tenant_scheduled_visit_assignees')
    .select('user_id, user_profiles ( display_name, avatar_url )')
    .eq('visit_id', visitId);
  const assignees = normalizeAssigneeRows(data as RawScheduleAssigneeRow[] | null);
  return { assignees, assigneeUserIds: assignees.map((row) => row.userId) };
}
