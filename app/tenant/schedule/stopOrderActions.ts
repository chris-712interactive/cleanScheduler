'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/session';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { DEFAULT_TENANT_TIMEZONE } from '@/lib/datetime/formatInTimeZone';
import { scheduleVisitsAfterStopOrder } from '@/lib/email/cleanerScheduleChange';
import { queueCleanerScheduleNotice } from '@/lib/email/notifyCleanerScheduleChanges';
import { loadCleanerScheduleVisitSnapshots } from '@/lib/schedule/loadCleanerScheduleVisits';
import { recordAppliedRouteDay } from '@/lib/routing/appliedRoutes';
import { loadCleanerStopOrder } from '@/lib/routing/loadCleanerStopOrder';
import { canApplyStopOrder } from '@/lib/routing/locks';
import { createAdminClient } from '@/lib/supabase/server';
import { isCalendarDateKey } from '@/lib/tenant/scheduleDateRange';
import { STOP_ORDER_UNAVAILABLE_MESSAGE } from '@/lib/routing/panelCopy';
import { isMissingColumnError } from '@/lib/supabase/optionalColumn';

export interface ApplyStopOrderState {
  error?: string;
  success?: boolean;
}

export async function applyStopOrderAction(
  _prev: ApplyStopOrderState,
  formData: FormData,
): Promise<ApplyStopOrderState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const dateKey = String(formData.get('date_key') ?? '').trim();
  const cleanerUserId = String(formData.get('cleaner_user_id') ?? '').trim();
  if (!slug || !isCalendarDateKey(dateKey) || !cleanerUserId) {
    return { error: 'Missing stop order.' };
  }

  const membership = await requireTenantPortalAccess(slug, '/schedule');
  const auth = await getAuthContext();
  if (!auth?.user.id) return { error: 'Sign in again to apply a stop order.' };

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
    return { error: 'Only the office can apply a stop order.' };
  }

  const { data: cleaner, error: cleanerError } = await admin
    .from('tenant_memberships')
    .select('user_id')
    .eq('tenant_id', membership.tenantId)
    .eq('user_id', cleanerUserId)
    .eq('is_active', true)
    .maybeSingle();
  if (cleanerError || !cleaner) return { error: 'That cleaner is not on this workspace.' };

  const [{ data: profile }, { data: tenantRow }] = await Promise.all([
    admin.from('user_profiles').select('display_name').eq('user_id', cleanerUserId).maybeSingle(),
    admin.from('tenants').select('timezone').eq('id', membership.tenantId).maybeSingle(),
  ]);

  let plan;
  try {
    plan = await loadCleanerStopOrder({
      supabase: admin,
      tenantId: membership.tenantId,
      dateKey,
      timeZone: tenantRow?.timezone?.trim() || DEFAULT_TENANT_TIMEZONE,
      cleanerUserId,
      cleanerName: profile?.display_name?.trim() || 'Cleaner',
    });
  } catch {
    return { error: 'Could not build the stop order.' };
  }
  if (!plan || !plan.sequenceAvailable) {
    return { error: STOP_ORDER_UNAVAILABLE_MESSAGE };
  }
  if (plan.ordered.length === 0) {
    return { error: 'There are no located stops to reorder.' };
  }

  const visitIds = [...plan.ordered, ...plan.unrouted].map((stop) => stop.id);
  const beforeOrder = await loadCleanerScheduleVisitSnapshots(admin, membership.tenantId, visitIds);

  for (const [index, stop] of plan.ordered.entries()) {
    const { error } = await admin
      .from('tenant_scheduled_visits')
      .update({ route_sequence: index + 1 })
      .eq('id', stop.id)
      .eq('tenant_id', membership.tenantId);
    if (error) {
      return {
        error: isMissingColumnError(error, 'route_sequence')
          ? STOP_ORDER_UNAVAILABLE_MESSAGE
          : 'Could not save the stop order.',
      };
    }
  }
  for (const stop of plan.unrouted) {
    const { error } = await admin
      .from('tenant_scheduled_visits')
      .update({ route_sequence: null })
      .eq('id', stop.id)
      .eq('tenant_id', membership.tenantId);
    if (error) {
      return {
        error: isMissingColumnError(error, 'route_sequence')
          ? STOP_ORDER_UNAVAILABLE_MESSAGE
          : 'Could not save the stop order.',
      };
    }
  }

  if (beforeOrder.ok) {
    try {
      queueCleanerScheduleNotice(admin, {
        tenantId: membership.tenantId,
        actorUserId: auth.user.id,
        before: beforeOrder.visits,
        after: scheduleVisitsAfterStopOrder(
          beforeOrder.visits,
          plan.ordered.map((stop) => stop.id),
          plan.unrouted.map((stop) => stop.id),
        ),
      });
    } catch (noticeError) {
      console.error(
        '[cleanerSchedule] queue failed:',
        noticeError instanceof Error ? noticeError.message : 'unknown',
      );
    }
  }

  const timeZone = tenantRow?.timezone?.trim() || DEFAULT_TENANT_TIMEZONE;
  try {
    await recordAppliedRouteDay(admin, {
      tenantId: membership.tenantId,
      serviceDate: dateKey,
      timeZone,
      replace: false,
      stats: [
        {
          userId: cleanerUserId,
          estimateKind: plan.estimateKind,
          miles: plan.estimatedMilesAfter,
          driveSeconds: plan.driveSecondsAfter,
          stopCount: plan.ordered.length,
        },
      ],
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
