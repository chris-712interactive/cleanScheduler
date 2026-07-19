'use server';

import { revalidatePath } from 'next/cache';
import { invalidateTenantNavBadges } from '@/lib/portal/invalidatePortalCache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import type { TenantRole } from '@/lib/auth/types';
import type { Database } from '@/lib/supabase/database.types';

import { parseTenantDatetimeLocalToIso } from '@/lib/datetime/parseTenantDatetimeLocal';
import { applyVisitScheduleTime } from '@/lib/schedule/applyVisitScheduleTime';
import {
  checkEmployeeAvailability,
  UNAVAILABILITY_LABEL,
} from '@/lib/schedule/employeeAvailability';
import { emitVisitWebhookEvent } from '@/lib/integrations/emitVisitWebhook';
import {
  resolveRescheduleTargetWindow,
  type AssigneeConflictInfo,
} from '@/lib/schedule/visitAssigneeConflicts';
import { applyVisitAssignees } from '@/lib/schedule/applyVisitAssignees';
import { recordRecurringOccurrenceSkip } from '@/lib/schedule/recurringOccurrenceSkips';
import { resolveScheduleJobPriceCents } from '@/lib/billing/resolveVisitExpectedAmount';
import { parseCentsFromDollars } from '@/lib/billing/parseMoney';
import {
  addConsultationDurationToStartIso,
  CONSULTATION_VISIT_TITLE,
  loadConsultationDurationMinutes,
} from '@/lib/tenant/consultationDuration';
import { sanitizeInternalReturnPath } from '@/lib/tenant/customerConsultation';
import { notifyCustomerRescheduleResolved } from '@/lib/email/rescheduleNotifications';
import type { VisitDetailPatch } from '@/lib/tenant/visitDetailPatch';
import { sanitizeConsultationNotes } from '@/lib/visits/consultationNotes';

export interface ScheduleFormState {
  error?: string;
  success?: boolean;
  conflicts?: AssigneeConflictInfo[];
  needsOverlapConfirm?: boolean;
  visitPatch?: VisitDetailPatch;
  resolvedRequestId?: string;
}

const VISIT_STATUSES = new Set<Database['public']['Enums']['visit_status']>([
  'scheduled',
  'completed',
  'cancelled',
]);

async function assertCustomer(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  customerId: string,
) {
  const { data } = await admin
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return !!data;
}

async function assertProperty(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  customerId: string,
  propertyId: string,
) {
  const { data } = await admin
    .from('tenant_customer_properties')
    .select('id')
    .eq('id', propertyId)
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .maybeSingle();
  return !!data;
}

async function assertQuote(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  quoteId: string,
) {
  const { data } = await admin
    .from('tenant_quotes')
    .select('id')
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  return !!data;
}

async function assertActiveTenantMember(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('tenant_memberships')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  return !!data;
}

async function loadTenantTimezone(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
): Promise<string> {
  const { data } = await admin.from('tenants').select('timezone').eq('id', tenantId).maybeSingle();
  return data?.timezone ?? 'America/New_York';
}

export async function createScheduledVisit(
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const propertyRaw = String(formData.get('property_id') ?? '').trim();
  const quoteRaw = String(formData.get('quote_id') ?? '').trim();
  const purposeRaw = String(formData.get('visit_purpose') ?? 'service').trim();
  const visitPurpose: Database['public']['Enums']['scheduled_visit_purpose'] =
    purposeRaw === 'consultation' ? 'consultation' : 'service';
  const titleRaw = String(formData.get('title') ?? '').trim();
  const startsRaw = String(formData.get('starts_at') ?? '').trim();
  const endsRaw = String(formData.get('ends_at') ?? '').trim();
  const notesRaw = String(formData.get('notes') ?? '').trim();
  const jobPriceDollars = String(formData.get('job_price_dollars') ?? '').trim();
  const statusRaw = String(formData.get('status') ?? 'scheduled').trim();
  const consultationTemplateRaw = String(
    formData.get('consultation_service_template_id') ?? '',
  ).trim();

  if (!slug || !customerId || !startsRaw) {
    return { error: 'Workspace, customer, and start time are required.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/schedule/new');
  const admin = createAdminClient();

  const title = visitPurpose === 'consultation' ? CONSULTATION_VISIT_TITLE : titleRaw || 'Visit';
  const notes = sanitizeConsultationNotes(notesRaw);
  const status =
    visitPurpose === 'consultation'
      ? 'scheduled'
      : VISIT_STATUSES.has(statusRaw as Database['public']['Enums']['visit_status'])
        ? (statusRaw as Database['public']['Enums']['visit_status'])
        : 'scheduled';

  if (visitPurpose !== 'consultation' && !endsRaw) {
    return { error: 'End time is required.' };
  }

  if (!(await assertCustomer(admin, membership.tenantId, customerId))) {
    return { error: 'Customer not found in this workspace.' };
  }

  let propertyId: string | null = null;
  if (propertyRaw) {
    if (!(await assertProperty(admin, membership.tenantId, customerId, propertyRaw))) {
      return { error: 'Service location does not belong to this customer.' };
    }
    propertyId = propertyRaw;
  }

  let quoteId: string | null = null;
  let consultationServiceTemplateId: string | null = null;
  if (visitPurpose === 'consultation') {
    if (quoteRaw) {
      return { error: 'Consultation visits cannot be linked to a quote.' };
    }
    if (!consultationTemplateRaw) {
      return { error: 'Select a service type for this consultation.' };
    }
    const { data: template } = await admin
      .from('tenant_service_templates')
      .select('id')
      .eq('id', consultationTemplateRaw)
      .eq('tenant_id', membership.tenantId)
      .eq('kind', 'service_line')
      .eq('is_active', true)
      .maybeSingle();
    if (!template?.id) {
      return { error: 'Service type not found in this workspace.' };
    }
    consultationServiceTemplateId = template.id;
  } else if (quoteRaw) {
    if (!(await assertQuote(admin, membership.tenantId, quoteRaw))) {
      return { error: 'Quote not found in this workspace.' };
    }
    quoteId = quoteRaw;
  }

  const tenantTimezone = await loadTenantTimezone(admin, membership.tenantId);
  const startsAt = parseTenantDatetimeLocalToIso(startsRaw, tenantTimezone);
  if (!startsAt) {
    return { error: 'Invalid start time.' };
  }

  let endsAt: string;
  if (visitPurpose === 'consultation') {
    const durationMinutes = await loadConsultationDurationMinutes(admin, membership.tenantId);
    endsAt = addConsultationDurationToStartIso(startsAt, durationMinutes);
  } else {
    const parsedEndsAt = parseTenantDatetimeLocalToIso(endsRaw, tenantTimezone);
    if (!parsedEndsAt) {
      return { error: 'Invalid end time.' };
    }
    endsAt = parsedEndsAt;
  }

  if (new Date(endsAt) < new Date(startsAt)) {
    return { error: 'End time must be after start time.' };
  }

  const pricing =
    visitPurpose === 'consultation'
      ? { expectedAmountCents: 0 }
      : await resolveScheduleJobPriceCents(admin, {
          tenantId: membership.tenantId,
          quoteId,
          jobPriceDollars,
        });
  if ('error' in pricing) {
    return { error: pricing.error };
  }

  const confirmUnavailable = formData.get('confirm_unavailable') === 'true';

  const ins = await admin
    .from('tenant_scheduled_visits')
    .insert({
      tenant_id: membership.tenantId,
      customer_id: customerId,
      property_id: propertyId,
      quote_id: quoteId,
      expected_amount_cents: pricing.expectedAmountCents,
      title,
      visit_purpose: visitPurpose,
      consultation_service_template_id: consultationServiceTemplateId,
      starts_at: startsAt,
      ends_at: endsAt,
      status,
      notes: notes || null,
      staffing_status: 'needs_staffing',
    })
    .select('id')
    .single();

  if (ins.error || !ins.data?.id) {
    return { error: ins.error?.message ?? 'Could not create visit.' };
  }

  const visitId = ins.data.id;

  const assigneeIds = formData
    .getAll('assignee_user_id')
    .map((x) => String(x).trim())
    .filter((x) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x),
    );
  const uniqueAssignees = [...new Set(assigneeIds)];

  for (const uid of uniqueAssignees) {
    if (!(await assertActiveTenantMember(admin, membership.tenantId, uid))) {
      await admin.from('tenant_scheduled_visits').delete().eq('id', visitId);
      return { error: 'One or more crew selections are not active members of this workspace.' };
    }
  }

  if (uniqueAssignees.length > 0 && status === 'scheduled' && !confirmUnavailable) {
    const unavailable: string[] = [];
    for (const uid of uniqueAssignees) {
      const result = await checkEmployeeAvailability(admin, {
        tenantId: membership.tenantId,
        userId: uid,
        startsAt,
        endsAt,
      });
      if (!result.available) {
        unavailable.push(`${uid}:${result.reasons.map((r) => UNAVAILABILITY_LABEL[r]).join(', ')}`);
      }
    }
    if (unavailable.length > 0) {
      await admin.from('tenant_scheduled_visits').delete().eq('id', visitId);
      return {
        error: `Some crew are unavailable at this time (${unavailable.length}). Adjust the time, pick different crew, or confirm scheduling anyway.`,
        needsOverlapConfirm: true,
      };
    }
  }

  if (uniqueAssignees.length > 0) {
    const insA = await admin
      .from('tenant_scheduled_visit_assignees')
      .insert(uniqueAssignees.map((user_id) => ({ visit_id: visitId, user_id })));
    if (insA.error) {
      await admin.from('tenant_scheduled_visits').delete().eq('id', visitId);
      return { error: insA.error.message };
    }

    const staffingStatus = confirmUnavailable ? 'override_confirmed' : 'assigned';
    await admin
      .from('tenant_scheduled_visits')
      .update({ staffing_status: staffingStatus })
      .eq('id', visitId)
      .eq('tenant_id', membership.tenantId);
  }

  if (status === 'scheduled') {
    await emitVisitWebhookEvent(admin, 'visit.scheduled', {
      tenantId: membership.tenantId,
      visitId,
      customerId,
      title,
      startsAt: startsAt,
      status,
    });
  }

  revalidatePath('/schedule');
  revalidatePath('/schedule/new');
  const returnTo = sanitizeInternalReturnPath(String(formData.get('return_to') ?? ''));
  redirect(returnTo ?? '/schedule');
}

export async function deleteScheduledVisit(
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const visitId = String(formData.get('visit_id') ?? '').trim();

  if (!slug || !visitId) {
    return { error: 'Missing visit.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/schedule');
  const admin = createAdminClient();

  const { data: visit, error: loadErr } = await admin
    .from('tenant_scheduled_visits')
    .select('id, recurring_rule_id, starts_at')
    .eq('id', visitId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (loadErr || !visit) {
    return { error: 'Visit not found.' };
  }

  if (visit.recurring_rule_id) {
    await recordRecurringOccurrenceSkip(admin, {
      recurringRuleId: visit.recurring_rule_id,
      startsAt: visit.starts_at,
      visitId: visit.id,
    });
  }

  const del = await admin
    .from('tenant_scheduled_visits')
    .delete()
    .eq('id', visitId)
    .eq('tenant_id', membership.tenantId);

  if (del.error) {
    return { error: del.error.message };
  }

  revalidatePath('/schedule');
  revalidatePath('/schedule/new');
  redirect('/schedule');
}

export async function updateScheduledVisitTimes(
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const visitId = String(formData.get('visit_id') ?? '').trim();
  const startsRaw = String(formData.get('starts_at') ?? '').trim();
  const endsRaw = String(formData.get('ends_at') ?? '').trim();

  if (!slug || !visitId || !startsRaw) {
    return { error: 'Workspace, visit, and start time are required.' };
  }

  const membership = await requireTenantPortalAccess(slug, `/schedule/${visitId}`);
  const admin = createAdminClient();

  const { data: visit, error: vErr } = await admin
    .from('tenant_scheduled_visits')
    .select('id, status, checked_in_at, visit_purpose')
    .eq('id', visitId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (vErr || !visit) {
    return { error: 'Visit not found.' };
  }

  if (visit.status !== 'scheduled') {
    return { error: 'Only scheduled visits can have their time updated.' };
  }

  if (visit.checked_in_at) {
    return {
      error:
        'This visit has been checked in. Contact an admin if the time still needs to be changed.',
    };
  }

  const tenantTimezone = await loadTenantTimezone(admin, membership.tenantId);
  const startsAt = parseTenantDatetimeLocalToIso(startsRaw, tenantTimezone);
  if (!startsAt) {
    return { error: 'Invalid start time.' };
  }

  let endsAt: string;
  if (visit.visit_purpose === 'consultation') {
    const durationMinutes = await loadConsultationDurationMinutes(admin, membership.tenantId);
    endsAt = addConsultationDurationToStartIso(startsAt, durationMinutes);
  } else {
    const parsedEndsAt = parseTenantDatetimeLocalToIso(endsRaw, tenantTimezone);
    if (!parsedEndsAt) {
      return { error: 'Invalid end time.' };
    }
    endsAt = parsedEndsAt;
  }

  if (new Date(endsAt) <= new Date(startsAt)) {
    return { error: 'End time must be after start time.' };
  }

  const confirmOverlap = String(formData.get('confirm_overlap') ?? '') === '1';
  const confirmUnavailable = String(formData.get('confirm_unavailable') ?? '') === 'true';

  const applied = await applyVisitScheduleTime(admin, {
    tenantId: membership.tenantId,
    visitId,
    startsAt,
    endsAt,
    confirmOverlap,
    confirmUnavailable,
    tenantTimezone,
  });

  if (!applied.ok) {
    return {
      error: applied.error,
      conflicts: applied.conflicts,
      needsOverlapConfirm: applied.needsOverlapConfirm,
    };
  }

  revalidatePath('/schedule');
  revalidatePath(`/schedule/${visitId}`);
  revalidatePath('/schedule/reschedule-requests');
  return {
    success: true,
    visitPatch: { startsAt, endsAt },
  };
}

export async function resolveVisitRescheduleRequest(
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const requestId = String(formData.get('request_id') ?? '').trim();
  const resolution = String(formData.get('resolution') ?? '').trim() as 'completed' | 'declined';
  const note = String(formData.get('tenant_response_note') ?? '').trim();
  const confirmOverlap = String(formData.get('confirm_overlap') ?? '') === '1';

  if (!slug || !requestId) {
    return { error: 'Missing request.' };
  }

  if (resolution !== 'completed' && resolution !== 'declined') {
    return { error: 'Invalid resolution.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/schedule/reschedule-requests');
  const auth = await getAuthContext();
  const actorId = auth?.user?.id ?? null;

  const admin = createAdminClient();

  const { data: request, error: reqErr } = await admin
    .from('visit_reschedule_requests')
    .select(
      `
      id,
      visit_id,
      customer_id,
      preferred_starts_at,
      preferred_ends_at,
      original_starts_at,
      original_ends_at,
      tenant_scheduled_visits (
        starts_at,
        ends_at,
        status,
        checked_in_at
      )
    `,
    )
    .eq('id', requestId)
    .eq('tenant_id', membership.tenantId)
    .eq('status', 'pending')
    .maybeSingle();

  if (reqErr || !request) {
    return { error: 'Request was already handled or could not be found.' };
  }

  const visit = request.tenant_scheduled_visits;
  if (!visit) {
    return { error: 'The linked visit no longer exists.' };
  }

  let appliedStartsAt: string | null = null;
  let appliedEndsAt: string | null = null;

  if (resolution === 'completed') {
    const window = resolveRescheduleTargetWindow(
      request.preferred_starts_at,
      request.preferred_ends_at,
      visit.starts_at,
      visit.ends_at,
    );
    if ('error' in window) {
      return { error: window.error };
    }

    appliedStartsAt = window.startsAt;
    appliedEndsAt = window.endsAt;

    const { data: tenantRow } = await admin
      .from('tenants')
      .select('timezone')
      .eq('id', membership.tenantId)
      .maybeSingle();
    const tenantTimezone = tenantRow?.timezone ?? 'America/New_York';

    const applied = await applyVisitScheduleTime(admin, {
      tenantId: membership.tenantId,
      visitId: request.visit_id,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      confirmOverlap,
      confirmUnavailable: false,
      tenantTimezone,
    });

    if (!applied.ok) {
      return {
        error: applied.error,
        conflicts: applied.conflicts,
        needsOverlapConfirm: applied.needsOverlapConfirm,
      };
    }
  }

  const nextStatus = resolution === 'completed' ? ('completed' as const) : ('declined' as const);

  const { data: updated, error: updErr } = await admin
    .from('visit_reschedule_requests')
    .update({
      status: nextStatus,
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: actorId,
      tenant_response_note: note || null,
      original_starts_at: request.original_starts_at ?? visit.starts_at,
      original_ends_at: request.original_ends_at ?? visit.ends_at,
      ...(resolution === 'completed'
        ? {
            applied_starts_at: appliedStartsAt,
            applied_ends_at: appliedEndsAt,
          }
        : {}),
    })
    .eq('id', requestId)
    .eq('tenant_id', membership.tenantId)
    .eq('status', 'pending')
    .select('id');

  if (updErr) {
    return { error: updErr.message };
  }

  if (!updated?.length) {
    return { error: 'Request was already handled or could not be found.' };
  }

  await notifyCustomerRescheduleResolved(admin, {
    tenantId: membership.tenantId,
    customerId: request.customer_id,
    visitId: request.visit_id,
    resolution,
    tenantNote: note || null,
    appliedStartsAt: appliedStartsAt,
  });

  revalidatePath('/schedule/reschedule-requests');
  revalidatePath('/schedule');
  revalidatePath(`/schedule/${request.visit_id}`);
  invalidateTenantNavBadges(membership.tenantId);
  return {
    success: true,
    resolvedRequestId: requestId,
    visitPatch:
      resolution === 'completed' && appliedStartsAt && appliedEndsAt
        ? { startsAt: appliedStartsAt, endsAt: appliedEndsAt }
        : undefined,
  };
}

export async function updateVisitJobPrice(
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const visitId = String(formData.get('visit_id') ?? '').trim();
  const jobPriceDollars = String(formData.get('job_price_dollars') ?? '').trim();

  if (!slug || !visitId) {
    return { error: 'Missing visit.' };
  }

  const membership = await requireTenantPortalAccess(slug, `/schedule/${visitId}`);
  const actorRole = membership.role as TenantRole;
  if (actorRole !== 'owner' && actorRole !== 'admin') {
    return { error: 'Only owners and admins can update job pricing.' };
  }

  const cents = parseCentsFromDollars(jobPriceDollars);
  if (cents == null || cents <= 0) {
    return { error: 'Enter a job price greater than zero.' };
  }

  const admin = createAdminClient();
  const { data: visit, error: loadErr } = await admin
    .from('tenant_scheduled_visits')
    .select('id, status')
    .eq('id', visitId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (loadErr || !visit) {
    return { error: 'Visit not found.' };
  }

  if (visit.status !== 'scheduled') {
    return { error: 'Job price can only be updated on scheduled visits.' };
  }

  const { error: upErr } = await admin
    .from('tenant_scheduled_visits')
    .update({
      expected_amount_cents: cents,
      updated_at: new Date().toISOString(),
    })
    .eq('id', visitId)
    .eq('tenant_id', membership.tenantId);

  if (upErr) {
    return { error: upErr.message };
  }

  revalidatePath('/schedule');
  revalidatePath(`/schedule/${visitId}`);
  return {
    success: true,
    visitPatch: { expectedAmountCents: cents },
  };
}

export async function updateScheduledVisitAssignees(
  _prev: ScheduleFormState,
  formData: FormData,
): Promise<ScheduleFormState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const visitId = String(formData.get('visit_id') ?? '').trim();

  if (!slug || !visitId) {
    return { error: 'Workspace and visit are required.' };
  }

  const membership = await requireTenantPortalAccess(slug, `/schedule/${visitId}`);
  const admin = createAdminClient();

  const assigneeIds = formData
    .getAll('assignee_user_id')
    .map((x) => String(x).trim())
    .filter((x) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x),
    );

  const confirmOverlap = String(formData.get('confirm_overlap') ?? '') === '1';
  const confirmUnavailable = String(formData.get('confirm_unavailable') ?? '') === 'true';
  const startsRaw = String(formData.get('starts_at') ?? '').trim();
  const endsRaw = String(formData.get('ends_at') ?? '').trim();

  const tenantTimezone = await loadTenantTimezone(admin, membership.tenantId);

  let startsAtOverride: string | undefined;
  let endsAtOverride: string | undefined;
  if (startsRaw && endsRaw) {
    const parsedStart = parseTenantDatetimeLocalToIso(startsRaw, tenantTimezone);
    const parsedEnd = parseTenantDatetimeLocalToIso(endsRaw, tenantTimezone);
    if (parsedStart && parsedEnd && new Date(parsedEnd) > new Date(parsedStart)) {
      startsAtOverride = parsedStart;
      endsAtOverride = parsedEnd;
    }
  }

  const applied = await applyVisitAssignees(admin, {
    tenantId: membership.tenantId,
    visitId,
    assigneeUserIds: assigneeIds,
    confirmOverlap,
    confirmUnavailable,
    tenantTimezone,
    startsAt: startsAtOverride,
    endsAt: endsAtOverride,
  });

  if (!applied.ok) {
    return {
      error: applied.error,
      conflicts: applied.conflicts,
      needsOverlapConfirm: applied.needsOverlapConfirm,
    };
  }

  revalidatePath('/schedule');
  revalidatePath(`/schedule/${visitId}`);
  return {
    success: true,
    visitPatch: {
      assignees: applied.assignees,
      assigneeUserIds: applied.assigneeUserIds,
    },
  };
}
