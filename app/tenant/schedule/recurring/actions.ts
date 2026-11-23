'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { parseBrowserDatetimeLocalToIso } from '@/lib/datetime/parseBrowserDatetimeLocal';
import { parseTenantDatetimeLocalToIso } from '@/lib/datetime/parseTenantDatetimeLocal';
import { DEFAULT_TENANT_TIMEZONE } from '@/lib/datetime/formatInTimeZone';
import {
  assertTenantCanCreateAutomationWorkflow,
  automationWorkflowGateErrorMessage,
} from '@/lib/billing/automationWorkflows';
import { resolveScheduleJobPriceCents } from '@/lib/billing/resolveVisitExpectedAmount';
import { notifyCustomerRecurringSeries } from '@/lib/email/recurringSeriesNotifications';
import type { RecurringSeriesSnapshot } from '@/lib/email/recurringSeriesNotifications';
import { queueCleanerScheduleNotice } from '@/lib/email/notifyCleanerScheduleChanges';
import { loadCleanerScheduleVisitSnapshots } from '@/lib/schedule/loadCleanerScheduleVisits';
import { rruleForRecurringPreset } from '@/lib/schedule/recurringPresets';
import {
  RECENT_SERIES_WINDOW_MS,
  isSeriesCreateConflict,
  recentDuplicateSeriesId,
  seriesCreateIdempotencyId,
} from '@/lib/schedule/recentRecurringSeries';
import { replaceFutureRecurringSeriesCrew } from '@/lib/schedule/replaceRecurringSeriesCrew';

const KEEP_PATTERN = '__keep__';

function seriesPath(query: string): string {
  return query ? `/schedule/recurring?${query}` : '/schedule/recurring';
}

async function displayNames(
  admin: ReturnType<typeof createAdminClient>,
  userIds: string[],
): Promise<string[]> {
  const ids = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return [];
  const { data } = await admin
    .from('user_profiles')
    .select('user_id, display_name')
    .in('user_id', ids);
  const byId = new Map(
    (data ?? []).map((row) => [row.user_id, row.display_name?.trim() || 'Team member']),
  );
  return ids.map((id) => byId.get(id) || 'Team member');
}

async function currentSeriesCrew(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  ruleId: string,
): Promise<string[]> {
  const { data: visits } = await admin
    .from('tenant_scheduled_visits')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('recurring_rule_id', ruleId)
    .eq('status', 'scheduled')
    .is('checked_in_at', null)
    .gte('starts_at', new Date().toISOString());
  const visitIds = (visits ?? []).map((visit) => visit.id);
  if (visitIds.length === 0) return [];
  const { data: assignees } = await admin
    .from('tenant_scheduled_visit_assignees')
    .select('user_id')
    .in('visit_id', visitIds);
  return displayNames(
    admin,
    (assignees ?? []).map((row) => row.user_id),
  );
}

function snapshot(
  rule: { title: string; rrule_definition: string; anchor_starts_at: string },
  cleanerNames: string[],
): RecurringSeriesSnapshot {
  return {
    title: rule.title,
    rruleDefinition: rule.rrule_definition,
    anchorStartsAt: rule.anchor_starts_at,
    cleanerNames,
  };
}

export async function createRecurringVisitRuleAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('tenant_slug') ?? '').trim();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const propertyRaw = String(formData.get('property_id') ?? '').trim();
  const preset = String(formData.get('preset') ?? '').trim();
  const title = String(formData.get('title') ?? '').trim() || 'Recurring visit';
  const startsRaw = String(formData.get('starts_at') ?? '').trim();
  const tzOffsetRaw = String(formData.get('client_timezone_offset') ?? '').trim();
  const horizonRaw = String(formData.get('horizon_days') ?? '60').trim();
  const durationRaw = String(formData.get('visit_duration_minutes') ?? '120').trim();
  const quoteRaw = String(formData.get('quote_id') ?? '').trim();
  const jobPriceDollars = String(formData.get('job_price_dollars') ?? '').trim();

  const rruleDefinition = rruleForRecurringPreset(preset);
  if (!slug || !customerId || !rruleDefinition || !startsRaw) {
    redirect(seriesPath('error=missing_fields'));
  }

  const membership = await requireTenantPortalAccess(slug, '/schedule/recurring');
  const admin = createAdminClient();
  const tzOffset = Number(tzOffsetRaw);
  if (!Number.isFinite(tzOffset)) {
    redirect(seriesPath('error=timezone'));
  }
  const anchorIso = parseBrowserDatetimeLocalToIso(startsRaw, tzOffset);
  if (!anchorIso) {
    redirect(seriesPath('error=invalid_start'));
  }
  const horizon = Number.parseInt(horizonRaw, 10);
  const horizonDays = Number.isFinite(horizon) ? Math.min(120, Math.max(1, horizon)) : 60;
  const duration = Number.parseInt(durationRaw, 10);
  const visitDuration =
    Number.isFinite(duration) && duration > 0 ? Math.min(24 * 60, duration) : 120;

  let propertyId: string | null = null;
  if (propertyRaw) {
    const { data: prop } = await admin
      .from('tenant_customer_properties')
      .select('id')
      .eq('id', propertyRaw)
      .eq('tenant_id', membership.tenantId)
      .eq('customer_id', customerId)
      .maybeSingle();
    if (!prop) redirect(seriesPath('error=bad_property'));
    propertyId = propertyRaw;
  }

  const { data: cust } = await admin
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();
  if (!cust) redirect(seriesPath('error=bad_customer'));

  try {
    await assertTenantCanCreateAutomationWorkflow(admin, membership.tenantId);
  } catch (error) {
    const message = automationWorkflowGateErrorMessage(error);
    redirect(seriesPath(`error=${encodeURIComponent(message ?? 'Recurring rule limit reached.')}`));
  }

  let quoteId: string | null = null;
  if (quoteRaw) {
    const { data: quote } = await admin
      .from('tenant_quotes')
      .select('id')
      .eq('id', quoteRaw)
      .eq('tenant_id', membership.tenantId)
      .maybeSingle();
    if (!quote) redirect(seriesPath('error=bad_quote'));
    quoteId = quoteRaw;
  }

  const pricing = await resolveScheduleJobPriceCents(admin, {
    tenantId: membership.tenantId,
    quoteId,
    jobPriceDollars,
  });
  if ('error' in pricing) {
    redirect(seriesPath(`error=${encodeURIComponent(pricing.error)}`));
  }

  const now = new Date();
  const { data: recentRows } = await admin
    .from('recurring_appointment_rules')
    .select('id, created_at, rrule_definition, anchor_starts_at')
    .eq('tenant_id', membership.tenantId)
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .gte('created_at', new Date(now.getTime() - RECENT_SERIES_WINDOW_MS).toISOString());
  const duplicateId = recentDuplicateSeriesId(recentRows ?? [], {
    rruleDefinition,
    anchorStartsAt: anchorIso,
    now,
  });
  if (duplicateId) {
    revalidatePath('/schedule/recurring');
    redirect(seriesPath('created=1'));
  }

  const { data: created, error } = await admin
    .from('recurring_appointment_rules')
    .insert({
      id: seriesCreateIdempotencyId({
        tenantId: membership.tenantId,
        customerId,
        rruleDefinition,
        anchorStartsAt: anchorIso,
        now,
      }),
      tenant_id: membership.tenantId,
      customer_id: customerId,
      property_id: propertyId,
      quote_id: quoteId,
      expected_amount_cents: pricing.expectedAmountCents,
      title,
      rrule_definition: rruleDefinition,
      anchor_starts_at: anchorIso,
      visit_duration_minutes: visitDuration,
      horizon_days: horizonDays,
      is_active: true,
    })
    .select('id, title, rrule_definition, anchor_starts_at')
    .single();
  if (isSeriesCreateConflict(error)) {
    revalidatePath('/schedule/recurring');
    redirect(seriesPath('created=1'));
  }
  if (error || !created) {
    redirect(
      seriesPath(`error=${encodeURIComponent(error?.message ?? 'Could not save the series.')}`),
    );
  }

  await notifyCustomerRecurringSeries(admin, {
    tenantId: membership.tenantId,
    customerId,
    ruleId: created.id,
    action: 'created',
    snapshot: snapshot(created, []),
  });

  revalidatePath('/schedule');
  revalidatePath('/schedule/recurring');
  redirect(seriesPath('created=1'));
}

export async function updateRecurringVisitRuleAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('tenant_slug') ?? '').trim();
  const ruleId = String(formData.get('rule_id') ?? '').trim();
  const preset = String(formData.get('preset') ?? '').trim();
  const startsRaw = String(formData.get('starts_at') ?? '').trim();
  const cleanerRaw = String(formData.get('cleaner_user_id') ?? '').trim();
  if (!slug || !ruleId || !preset || !startsRaw) {
    redirect(seriesPath('error=missing_fields'));
  }

  const membership = await requireTenantPortalAccess(slug, '/schedule/recurring');
  const admin = createAdminClient();
  const { data: existing, error: loadError } = await admin
    .from('recurring_appointment_rules')
    .select('id, customer_id, title, rrule_definition, anchor_starts_at, is_active')
    .eq('id', ruleId)
    .eq('tenant_id', membership.tenantId)
    .eq('is_active', true)
    .maybeSingle();
  if (loadError || !existing) {
    redirect(seriesPath('error=Series%20not%20found'));
  }

  const nextRrule =
    preset === KEEP_PATTERN ? existing.rrule_definition : rruleForRecurringPreset(preset);
  if (!nextRrule) redirect(seriesPath('error=missing_fields'));

  const { data: tenant } = await admin
    .from('tenants')
    .select('timezone')
    .eq('id', membership.tenantId)
    .maybeSingle();
  const anchorIso = parseTenantDatetimeLocalToIso(
    startsRaw,
    tenant?.timezone ?? DEFAULT_TENANT_TIMEZONE,
  );
  if (!anchorIso) redirect(seriesPath('error=invalid_start'));

  const beforeCleaners = await currentSeriesCrew(admin, membership.tenantId, ruleId);
  let afterCleaners = beforeCleaners;
  let crewVisitIds: string[] = [];
  let crewUnstored = false;
  let beforeVisits: Awaited<ReturnType<typeof loadCleanerScheduleVisitSnapshots>> | null = null;

  if (cleanerRaw) {
    const { data: upcoming } = await admin
      .from('tenant_scheduled_visits')
      .select('id')
      .eq('tenant_id', membership.tenantId)
      .eq('recurring_rule_id', ruleId)
      .eq('status', 'scheduled')
      .is('checked_in_at', null)
      .gte('starts_at', new Date().toISOString());
    crewVisitIds = (upcoming ?? []).map((visit) => visit.id);
    beforeVisits = await loadCleanerScheduleVisitSnapshots(
      admin,
      membership.tenantId,
      crewVisitIds,
    );
    const replaced = await replaceFutureRecurringSeriesCrew(admin, {
      tenantId: membership.tenantId,
      ruleId,
      assigneeUserId: cleanerRaw,
    });
    if (!replaced.ok) {
      redirect(seriesPath(`error=${encodeURIComponent(replaced.error)}`));
    }
    crewVisitIds = replaced.visitIds;
    crewUnstored = !replaced.stored;
    if (replaced.changed) {
      afterCleaners = await displayNames(admin, [cleanerRaw]);
    }
  }

  const { data: updated, error } = await admin
    .from('recurring_appointment_rules')
    .update({
      rrule_definition: nextRrule,
      anchor_starts_at: anchorIso,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ruleId)
    .eq('tenant_id', membership.tenantId)
    .eq('is_active', true)
    .select('id, title, rrule_definition, anchor_starts_at')
    .maybeSingle();
  if (error || !updated) {
    redirect(
      seriesPath(`error=${encodeURIComponent(error?.message ?? 'Could not update the series.')}`),
    );
  }

  await notifyCustomerRecurringSeries(admin, {
    tenantId: membership.tenantId,
    customerId: existing.customer_id,
    ruleId,
    action: 'changed',
    previous: snapshot(existing, beforeCleaners),
    snapshot: snapshot(updated, afterCleaners),
  });

  if (beforeVisits?.ok && crewVisitIds.length > 0 && cleanerRaw) {
    const afterVisits = await loadCleanerScheduleVisitSnapshots(
      admin,
      membership.tenantId,
      crewVisitIds,
    );
    if (afterVisits.ok) {
      const auth = await getAuthContext();
      queueCleanerScheduleNotice(admin, {
        tenantId: membership.tenantId,
        actorUserId: auth?.user.id ?? null,
        before: beforeVisits.visits,
        after: afterVisits.visits,
      });
    }
  }

  revalidatePath('/schedule');
  revalidatePath('/schedule/recurring');
  redirect(seriesPath(crewUnstored ? 'updated=1&crew=later' : 'updated=1'));
}

export async function deactivateRecurringVisitRuleAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('tenant_slug') ?? '').trim();
  const ruleId = String(formData.get('rule_id') ?? '').trim();
  const membership = await requireTenantPortalAccess(slug, '/schedule/recurring');
  const admin = createAdminClient();
  const cleaners = await currentSeriesCrew(admin, membership.tenantId, ruleId);
  const { data: updated, error } = await admin
    .from('recurring_appointment_rules')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', ruleId)
    .eq('tenant_id', membership.tenantId)
    .eq('is_active', true)
    .select('id, customer_id, title, rrule_definition, anchor_starts_at')
    .maybeSingle();
  if (error) {
    redirect(seriesPath(`error=${encodeURIComponent(error.message)}`));
  }
  if (!updated) {
    redirect('/schedule/recurring');
  }

  await notifyCustomerRecurringSeries(admin, {
    tenantId: membership.tenantId,
    customerId: updated.customer_id,
    ruleId: updated.id,
    action: 'cancelled',
    snapshot: snapshot(updated, cleaners),
  });

  revalidatePath('/schedule/recurring');
  redirect('/schedule/recurring');
}
