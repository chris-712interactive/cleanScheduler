'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { isFeatureEnabled, resolveTenantRoutingPlan } from '@/lib/billing/entitlements';
import { featureUpgradeMessage } from '@/lib/billing/entitlements';
import { DEFAULT_TENANT_TIMEZONE } from '@/lib/datetime/formatInTimeZone';
import { scheduleVisitsFromDispatch } from '@/lib/email/cleanerScheduleChange';
import { queueCleanerScheduleNotice } from '@/lib/email/notifyCleanerScheduleChanges';
import { recordAppliedRouteDay } from '@/lib/routing/appliedRoutes';
import { dispatchJobCapBreach, validateDispatchApply } from '@/lib/routing/dispatchPlan';
import { loadDispatchPlan } from '@/lib/routing/loadDispatchPlan';
import { canApplyStopOrder } from '@/lib/routing/locks';
import { heldDispatchPlan } from '@/lib/routing/reoptimize';
import { DISPATCH_UNAVAILABLE_MESSAGE } from '@/lib/routing/panelCopy';
import { createAdminClient } from '@/lib/supabase/server';
import { isMissingColumnError } from '@/lib/supabase/optionalColumn';
import { isCalendarDateKey } from '@/lib/tenant/scheduleDateRange';

export interface ApplyDispatchState {
  error?: string;
  success?: boolean;
}

/**
 * Saves the suggested crew and stop order, then emails each cleaner whose
 * day changed. The save does not wait on Resend and does not fail if mail fails.
 */
export async function applyDispatchAction(
  _prev: ApplyDispatchState,
  formData: FormData,
): Promise<ApplyDispatchState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const dateKey = String(formData.get('date_key') ?? '').trim();
  const submittedFingerprint = String(formData.get('fingerprint') ?? '').trim();
  const submittedPlanKey = String(formData.get('plan_key') ?? '').trim();
  if (!slug || !isCalendarDateKey(dateKey) || !submittedFingerprint || !submittedPlanKey) {
    return { error: 'Missing dispatch.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/schedule');
  const auth = await getAuthContext();
  if (!auth?.user.id) return { error: 'Sign in again to apply a dispatch.' };

  const admin = createAdminClient();
  const { data: actor, error: actorError } = await admin
    .from('tenant_memberships')
    .select('role')
    .eq('tenant_id', membership.tenantId)
    .eq('user_id', auth.user.id)
    .eq('is_active', true)
    .maybeSingle();
  if (actorError) return { error: 'Could not confirm your role.' };
  if (!canApplyStopOrder(actor?.role)) {
    return { error: 'Only the office can apply a dispatch.' };
  }

  const reoptimize = String(formData.get('mode') ?? '') === 'reoptimize';
  const planKey = await resolveTenantRoutingPlan(admin, membership.tenantId);
  if (reoptimize && !isFeatureEnabled(planKey, 'routeReoptimization')) {
    return { error: featureUpgradeMessage('routeReoptimization') };
  }
  if (!isFeatureEnabled(planKey, 'multiCleanerDispatch')) {
    return { error: featureUpgradeMessage('multiCleanerDispatch') };
  }

  const { data: tenantRow } = await admin
    .from('tenants')
    .select('timezone')
    .eq('id', membership.tenantId)
    .maybeSingle();

  let proposal;
  try {
    proposal = await loadDispatchPlan({
      supabase: admin,
      tenantId: membership.tenantId,
      dateKey,
      timeZone: tenantRow?.timezone?.trim() || DEFAULT_TENANT_TIMEZONE,
      plan: planKey,
    });
  } catch {
    return { error: 'Could not build the dispatch.' };
  }
  if (!proposal) return { error: 'Could not build the dispatch.' };
  if (!proposal.sequenceAvailable) return { error: DISPATCH_UNAVAILABLE_MESSAGE };
  if (proposal.plan.visits.length === 0) return { error: 'There are no visits to dispatch.' };

  const held = reoptimize
    ? heldDispatchPlan(proposal.plan, proposal.snapshot, proposal.fixedVisitIds)
    : { plan: proposal.plan, planKey: proposal.planKey };

  const { data: members, error: memberError } = await admin
    .from('tenant_memberships')
    .select('user_id')
    .eq('tenant_id', membership.tenantId)
    .eq('is_active', true);
  if (memberError) return { error: 'Could not confirm the cleaners.' };

  const decision = validateDispatchApply({
    tenantId: membership.tenantId,
    visitTenants: new Map(proposal.snapshot.map((row) => [row.id, membership.tenantId])),
    activeCleanerIds: new Set((members ?? []).map((member) => member.user_id)),
    snapshotIds: proposal.snapshot.map((row) => row.id),
    actualFingerprint: proposal.fingerprint,
    submittedFingerprint,
    actualPlanKey: held.planKey,
    submittedPlanKey,
    plan: held.plan,
  });
  if (decision === 'stale') {
    return {
      error: reoptimize
        ? 'This day changed. Re-optimize again.'
        : 'This day changed. Suggest dispatch again.',
    };
  }
  if (decision === 'tenant') return { error: 'That plan does not belong to this workspace.' };

  const { data: capRows, error: capError } = await admin
    .from('tenant_member_scheduling_profiles')
    .select('user_id, max_jobs_per_day')
    .eq('tenant_id', membership.tenantId);
  if (capError) return { error: 'Could not confirm daily job caps.' };
  const capByUser = new Map((capRows ?? []).map((row) => [row.user_id, row.max_jobs_per_day]));
  const cappedIds = new Set(capByUser.keys());
  for (const visit of held.plan.visits) {
    for (const cleanerId of visit.assigneeIds) cappedIds.add(cleanerId);
  }
  const overCap = dispatchJobCapBreach({
    cleaners: [...cappedIds].map((id) => ({
      id,
      maxJobsPerDay: capByUser.get(id) ?? null,
    })),
    planVisits: held.plan.visits,
  });
  if (overCap) {
    return {
      error: reoptimize
        ? 'This plan would put a cleaner over their max jobs for the day. Re-optimize again.'
        : 'This plan would put a cleaner over their max jobs for the day. Suggest dispatch again.',
    };
  }

  const { error } = await admin.rpc('apply_cleaner_dispatch', {
    p_tenant_id: membership.tenantId,
    p_snapshot: proposal.snapshot,
    p_plan: held.plan.visits,
  });
  if (error) {
    const text = `${error.message} ${error.details ?? ''} ${error.hint ?? ''}`;
    if (text.includes('stale_dispatch')) {
      return {
        error: reoptimize
          ? 'This day changed. Re-optimize again.'
          : 'This day changed. Suggest dispatch again.',
      };
    }
    if (text.includes('cleaner_not_in_tenant') || text.includes('tenant_mismatch')) {
      return { error: 'That plan does not belong to this workspace.' };
    }
    if (
      isMissingColumnError(error, 'route_sequence') ||
      text.includes('apply_cleaner_dispatch') ||
      error.code === 'PGRST202'
    ) {
      return { error: DISPATCH_UNAVAILABLE_MESSAGE };
    }
    return { error: 'Could not save the dispatch.' };
  }

  const labels = new Map<string, { title: string; customerName: string }>();
  for (const cleaner of proposal.cleaners) {
    for (const stop of cleaner.stops) {
      labels.set(stop.id, { title: stop.title, customerName: stop.customerName });
    }
  }
  for (const stop of proposal.unassigned) {
    labels.set(stop.id, { title: stop.title, customerName: stop.customerName });
  }
  const rows = scheduleVisitsFromDispatch({
    snapshot: proposal.snapshot,
    plan: held.plan.visits,
    labels,
  });
  try {
    queueCleanerScheduleNotice(admin, {
      tenantId: membership.tenantId,
      actorUserId: auth.user.id,
      before: rows.before,
      after: rows.after,
    });
  } catch (noticeError) {
    console.error(
      '[cleanerSchedule] queue failed:',
      noticeError instanceof Error ? noticeError.message : 'unknown',
    );
  }

  try {
    await recordAppliedRouteDay(admin, {
      tenantId: membership.tenantId,
      serviceDate: dateKey,
      timeZone: tenantRow?.timezone?.trim() || DEFAULT_TENANT_TIMEZONE,
      replace: true,
      stats: held.plan.assignments
        .filter((row) => row.orderedIds.length > 0)
        .map((row) => ({
          userId: row.cleanerId,
          estimateKind: held.plan.estimateKind,
          miles: row.estimatedMiles,
          driveSeconds: row.driveSeconds,
          stopCount: row.orderedIds.length,
        })),
    });
  } catch (saveError) {
    console.error(
      '[routing] drive time was not saved:',
      saveError instanceof Error ? saveError.message : 'unknown',
    );
  }

  revalidatePath('/schedule', 'page');
  revalidatePath('/tenant/schedule', 'page');
  revalidatePath('/schedule/map', 'page');
  revalidatePath('/tenant/schedule/map', 'page');
  return { success: true };
}
